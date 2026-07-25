import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchArtifactText, fetchIteration, fetchIterations, fetchRun } from "../api/client";
import type { Artifact, Iteration, MetricMeta, RunMeta } from "../api/types";
import {
  chartSections,
  formatDateTime,
  formatMetric,
  groupMetricKeys,
  iterationsById,
  metricBaseNames,
  metricLabel,
  metricMeta,
  metricSetBases,
  reconcileOrder,
  reorderGroups,
  selectMetricKeys,
  type MetricGroup,
} from "../format";
import { cn, iterationPath } from "../util";
import { computeGenerations } from "../graph/generation";
import { islandColor } from "../islandColor";
import { useDatadir } from "../hooks/useDatadir";
import { useSessionState } from "../hooks/useSessionState";
import { useAsyncData } from "../hooks/useAsyncData";
import DiffView from "../components/DiffView";
import CodeView from "../components/CodeView";
import MarkdownView from "../components/MarkdownView";
import MetricFilter from "../components/MetricFilter";
import PillToggle from "../components/PillToggle";
import ArtifactToc, { type ArtifactEntry } from "../components/ArtifactToc";
import { BackLink, BackToTop } from "../components/NavButtons";
import { ErrorBanner, LoadingMessage } from "../components/Status";

/** Comparison-column sentinel selecting the all-iteration mean rather than a
 *  specific iteration. */
const MEAN = "__mean__";
const PARENT = "__parent__";

/** URL/anchor-safe slug from an arbitrary label. */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Initials of a label: first letter of each whitespace/hyphen-separated word.
 *  "Combined Score" → "CS", "mean-recall" → "mr". Used as the collapsed form of
 *  the compact-header metric label when the title overflows. */
function initialsOf(label: string): string {
  return label
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("");
}

/** Lazily loads one artifact's bytes and renders it by type, behind a fold whose
 *  collapsed/expanded state is owned by the page. The body stays mounted after
 *  its first reveal so re-toggling is instant. */
function ArtifactSection({
  iterationId,
  datadir,
  artifact,
  anchorId,
  collapsed,
  wrap,
  onToggle,
}: {
  iterationId: string;
  datadir: string;
  artifact: Artifact;
  anchorId: string;
  collapsed: boolean;
  wrap: boolean;
  onToggle: () => void;
}) {
  const { data: text, error } = useAsyncData(
    () => fetchArtifactText(iterationId, artifact.path, datadir),
    [iterationId, artifact.path, datadir],
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!collapsed) setMounted(true);
  }, [collapsed]);

  return (
    <section className="artifact" id={anchorId}>
      <h3 className="artifact-fold" onClick={onToggle}>
        <svg
          className={cn("artifact-chevron", !collapsed && "open")}
          viewBox="0 0 16 16"
          aria-hidden
        >
          <path d="M6 3.5L10.5 8L6 12.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {artifact.label ?? artifact.path}
      </h3>
      {mounted && (
        <div className={cn("artifact-body", wrap && "wrap")} hidden={collapsed}>
          <ErrorBanner error={error} />
          {text === null && !error && <LoadingMessage />}
          {text !== null && artifact.type === "diff" && <DiffView diffText={text} />}
          {text !== null && artifact.type === "code" && <CodeView code={text} language={artifact.language} />}
          {text !== null && artifact.type === "file" && <CodeView code={text} language={artifact.language} />}
        </div>
      )}
    </section>
  );
}

/** Change of one metric against a baseline (parent iteration or all-iteration
 *  mean): a direction arrow plus the percentage change, tinted good/bad by the
 *  metric's `higherIsBetter` (defaults to higher-is-better when unspecified).
 *  Percentage is relative to |baseline|; when the baseline is 0 the absolute
 *  difference is shown instead. A zero change renders nothing. */
function MetricDelta({
  value,
  baseline,
  meta,
}: {
  value: number;
  baseline?: number;
  meta?: MetricMeta | null;
}) {
  if (baseline === undefined) return null;
  const diff = value - baseline;
  if (diff === 0) return null;
  const up = diff > 0;
  const higherIsBetter = meta?.higherIsBetter ?? true;
  const tone = up === higherIsBetter ? "good" : "bad";
  const pct = baseline !== 0 ? (Math.abs(diff) / Math.abs(baseline)) * 100 : null;
  return (
    <span className={`metric-delta-chip ${tone}`}>
      <span className="metric-delta-arrow">{up ? "▲" : "▼"}</span>
      <span className="metric-delta-pct">
        {pct !== null ? `${pct.toFixed(1)}%` : formatMetric(Math.abs(diff), meta)}
      </span>
    </span>
  );
}

/** Tracks whether the window has scrolled past a pixel threshold. Uses
 *  hysteresis (a lower threshold to leave the "past" state) so the compact
 *  header can't flicker when scroll rests at the boundary, and stays stable
 *  against the document-height shift the compact transition itself causes. */
function useScrolledPast(threshold: number, hysteresis = 24): boolean {
  const [past, setPast] = useState(false);
  const pastRef = useRef(false);
  useEffect(() => {
    const update = () => {
      const y = window.scrollY;
      const next = pastRef.current ? y > threshold - hysteresis : y > threshold;
      if (next !== pastRef.current) {
        pastRef.current = next;
        setPast(next);
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold, hysteresis]);
  return past;
}

/** Full detail for one iteration: metrics table, description, artifacts. */
export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const datadir = useDatadir();
  const [iteration, setIteration] = useState<Iteration | null>(null);
  const [iterations, setIterations] = useState<Iteration[]>([]);
  const [run, setRun] = useState<RunMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [wrap, setWrap] = useSessionState("evo.artifactWrap", true);
  const compact = useScrolledPast(120);

  // Compact-header metric label: collapses to its initials when the title would
  // overflow with the full label. `titleRef` detects overflow; the ghost spans
  // measure full vs. abbreviated label widths; `metricRef`/`topRef` measure the
  // free space (margin-left:auto gap) to know when the full label fits again.
  // The container is observed so re-evaluation runs on resize — the title's own
  // size is stable once it fits, so observing it alone would miss grow-events.
  const titleRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const metricRef = useRef<HTMLSpanElement>(null);
  const topRef = useRef<HTMLSpanElement>(null);
  const fullGhostRef = useRef<HTMLSpanElement>(null);
  const abbrGhostRef = useRef<HTMLSpanElement>(null);
  const [abbrMetric, setAbbrMetric] = useState(false);

  // Metric filter — shared with Dashboard via identical sessionStorage keys.
  const [selectedBases, setSelectedBases] = useSessionState<string[]>("evo.selectedBases", []);
  const [selectedGroups, setSelectedGroups] = useSessionState<(string | null)[]>("evo.selectedGroups", []);
  const [basesOrder, setBasesOrder] = useSessionState<string[]>("evo.basesOrder", []);
  const [groupsOrder, setGroupsOrder] = useSessionState<(string | null)[]>("evo.groupsOrder", []);
  const [selectionInitialized, setSelectionInitialized] = useSessionState("evo.selectionInitialized", false);
  const [separateMetricSections, setSeparateMetricSections] = useSessionState("evo.separateMetricSections", true);
  const [interleaveMetrics, setInterleaveMetrics] = useSessionState("evo.interleaveMetrics", false);

  useEffect(() => {
    if (!id || !datadir) return;
    let active = true;
    Promise.all([fetchIteration(id, datadir), fetchRun(datadir), fetchIterations(datadir)])
      .then(([it, r, all]) => {
        if (!active) return;
        setIteration(it);
        setRun(r);
        setIterations(all);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [id, datadir]);

  // Metric filter derivation — mirrors Dashboard logic so the same pills and
  // selection are usable on both pages.
  const metricGroups = useMemo(() => groupMetricKeys(run, iterations), [run, iterations]);
  const metricBases = useMemo(() => metricBaseNames(metricGroups), [metricGroups]);

  // Keep the drag-order arrays in sync with the present metrics (mirrors the
  // Dashboard reconcile; runs here too because the detail page fetches its own
  // copy of the iteration set and may open before the dashboard ever mounts).
  useEffect(() => {
    setBasesOrder((prev) => reconcileOrder(prev, metricBases));
    setGroupsOrder((prev) => reconcileOrder(prev, metricGroups.map((group) => group.prefix)));
  }, [metricBases, metricGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flat key list in the user's drag order (canonical order as fallback).
  const metricKeys = useMemo(
    () => reorderGroups(metricGroups, groupsOrder, basesOrder).flatMap((group) => group.keys),
    [metricGroups, groupsOrder, basesOrder],
  );

  // Initialize selection if Dashboard hasn't done it yet (detail page opened first).
  useEffect(() => {
    if (selectionInitialized || metricKeys.length === 0) return;
    const sets = run?.metricSets ?? {};
    const defaultName = run?.defaultMetricSet ?? Object.keys(sets)[0];
    const defaultEntries = defaultName ? sets[defaultName] : undefined;
    const resolved = defaultEntries ? metricSetBases(defaultEntries, metricBases) : metricBases;
    setSelectedBases(resolved.length ? resolved : metricBases);
    setSelectedGroups(metricGroups.map((group) => group.prefix));
    setSelectionInitialized(true);
  }, [run, metricKeys, metricBases, metricGroups, selectionInitialized]);

  const chartedMetrics = useMemo(
    () => selectMetricKeys(metricKeys, selectedBases, selectedGroups),
    [metricKeys, selectedBases, selectedGroups],
  );

  // Filter metricGroups to only keys in chartedMetrics, in drag-authored order.
  const filteredGroups = useMemo<MetricGroup[]>(() => {
    const chartedSet = new Set(chartedMetrics);
    return reorderGroups(metricGroups, groupsOrder, basesOrder)
      .map((group) => ({ prefix: group.prefix, keys: group.keys.filter((key) => chartedSet.has(key)) }))
      .filter((group) => group.keys.length > 0);
  }, [metricGroups, chartedMetrics, groupsOrder, basesOrder]);

  // Ordered metric keys for the table, sectioned by the Display toggles.
  const tableSections = useMemo(
    () => chartSections(run, filteredGroups, interleaveMetrics, separateMetricSections, basesOrder),
    [run, filteredGroups, interleaveMetrics, separateMetricSections, basesOrder],
  );

  // Stable anchor id per artifact, deduped against slug collisions.
  const artifactEntries = useMemo<ArtifactEntry[]>(() => {
    if (!iteration) return [];
    const seen = new Set<string>();
    return iteration.artifacts.map((artifact) => {
      let anchorId = `artifact-${slugify(artifact.label ?? artifact.path)}`;
      while (seen.has(anchorId)) anchorId += "-x";
      seen.add(anchorId);
      return { artifact, anchorId };
    });
  }, [iteration]);

  // Parent iteration: the "parent" target of the metrics-table comparison
  // dropdown (the default when present). Also feeds this iteration's generation
  // (parent-chain depth). Derived from the full iteration set.
  const parentIteration = useMemo(
    () => (iteration?.parent ? iterationsById(iterations).get(iteration.parent) ?? null : null),
    [iteration, iterations],
  );
  const generation = useMemo(
    () => (iteration ? computeGenerations(iterations).get(iteration.id) : undefined),
    [iteration, iterations],
  );
  // Per-metric mean across all iterations — the "mean" target of the
  // metrics-table comparison dropdown (NaN/non-numeric values skipped).
  const metricMeans = useMemo(() => {
    const acc: Record<string, { sum: number; count: number }> = {};
    for (const it of iterations) {
      for (const [key, value] of Object.entries(it.metrics)) {
        if (typeof value !== "number" || Number.isNaN(value)) continue;
        (acc[key] ??= { sum: 0, count: 0 });
        acc[key].sum += value;
        acc[key].count += 1;
      }
    }
    const means: Record<string, number> = {};
    for (const [key, { sum, count }] of Object.entries(acc)) {
      if (count > 0) means[key] = sum / count;
    }
    return means;
  }, [iterations]);

  // Baseline = the root iteration (no parent); ties broken by smallest id. It
  // is the comparison dropdown's default target (falls back to parent, then
  // mean, only when no baseline exists).
  const baselineIteration = useMemo(() => {
    const roots = iterations.filter((it) => !it.parent);
    return roots.length ? roots.reduce((a, b) => (a.id <= b.id ? a : b)) : null;
  }, [iterations]);
  // Comparison target: one of PARENT, MEAN, or an iteration id. Null tracks the
  // default (baseline, else parent, else mean) without an effect, so the default
  // follows the loaded set while an explicit choice survives navigation between
  // iterations.
  const [compareTarget, setCompareTarget] = useState<string | null>(null);
  const compareTargetId = compareTarget ?? (baselineIteration?.id ?? (parentIteration ? PARENT : MEAN));
  const compareIteration = useMemo(
    () =>
      compareTargetId !== MEAN && compareTargetId !== PARENT
        ? iterationsById(iterations).get(compareTargetId) ?? null
        : null,
    [compareTargetId, iterations],
  );
  // Resolves the comparison value for a metric key according to the current
  // dropdown target: mean across iterations, this iteration's parent, or a
  // specifically selected iteration.
  const resolveCompareValue = (key: string): number | undefined =>
    compareTargetId === MEAN
      ? metricMeans[key]
      : compareTargetId === PARENT
        ? parentIteration?.metrics[key]
        : compareIteration?.metrics[key];
  // Iterations ordered by id for the comparison dropdown's option list.
  const compareOptions = useMemo(
    () => [...iterations].sort((a, b) => a.id.localeCompare(b.id)),
    [iterations],
  );

  const toggleArtifact = (anchorId: string) =>
    setCollapsed((m) => ({ ...m, [anchorId]: !(m[anchorId] ?? true) }));

  // TOC click: open the chosen artifact, collapse every other, then scroll to it.
  const focusArtifact = (anchorId: string) => {
    setCollapsed(Object.fromEntries(artifactEntries.map((e) => [e.anchorId, e.anchorId !== anchorId])));
    document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth" });
  };

  const firstMetric = iteration ? Object.entries(iteration.metrics)[0] : undefined;
  const firstMetricLabel = firstMetric ? metricLabel(run, firstMetric[0]) : "";
  const firstMetricAbbr = useMemo(() => initialsOf(firstMetricLabel), [firstMetricLabel]);
  const firstMetricMeta = firstMetric ? metricMeta(run, firstMetric[0]) : null;

  // Hysteresis on the title's available width (clamped clientWidth + the
  // margin-left:auto free space, measured as the metric↔Top gap minus the flex
  // gap). Abbreviate once the title would overflow with the full label
  // (scrollWidth > avail); revert only once the full label fits again
  // (scrollWidth + labelGap ≤ avail). The thresholds can't both hold, so no
  // oscillation. The container — not the title — is observed: once the title
  // fits it stops changing size, so observing it would miss window-grow events.
  useLayoutEffect(() => {
    if (!compact || !firstMetricLabel) {
      setAbbrMetric(false);
      return;
    }
    const titleEl = titleRef.current;
    const containerEl = containerRef.current;
    const metricEl = metricRef.current;
    const topEl = topRef.current;
    const fullGhost = fullGhostRef.current;
    const abbrGhost = abbrGhostRef.current;
    if (!titleEl || !containerEl || !metricEl || !topEl || !fullGhost || !abbrGhost) return;
    const gap = fullGhost.offsetWidth - abbrGhost.offsetWidth;
    const check = () => {
      const titleRect = titleEl.getBoundingClientRect();
      const metricRect = metricEl.getBoundingClientRect();
      const topRect = topEl.getBoundingClientRect();
      // The gap between metric and Top is the flex gap PLUS the margin-left:auto
      // free space. Subtract the flex gap (measured between title and metric,
      // which have no auto-margin between them) to isolate the actual free
      // space. The title's available width = clamped clientWidth + free space.
      const flexGap = metricRect.left - titleRect.right;
      const marginLeft = topRect.left - metricRect.right - flexGap;
      const avail = titleEl.clientWidth + marginLeft;
      const scrollW = titleEl.scrollWidth;
      if (!abbrMetric && scrollW > avail + 1) {
        setAbbrMetric(true);
        return;
      }
      if (abbrMetric && scrollW + gap + 1 <= avail) {
        setAbbrMetric(false);
      }
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [compact, abbrMetric, firstMetricLabel, firstMetricAbbr]);

  return (
    <div className="detail-page">
      <header className={cn("detail-header", compact && "compact")}>
        <div className="detail-header-inner">
          <BackLink />
          <ErrorBanner error={error} />
          {!iteration && !error && <LoadingMessage />}
          {iteration && (
            <>
              <h1>
                #{iteration.id} {iteration.title ?? ""}
              </h1>
              {iteration.timestamp && (
                <div className="detail-meta">{formatDateTime(iteration.timestamp)}</div>
              )}
              {iteration.parent && (
                <div className="detail-meta">
                  parent: <Link to={iterationPath(iteration.parent, datadir)}>#{iteration.parent}</Link>
                </div>
              )}
              {(iteration.island != null || generation != null) && (
                <div className="detail-meta detail-lineage">
                  {iteration.island != null && (
                    <span className="tag island-chip" style={{ background: islandColor(iteration.island) }}>
                      island: <strong>{iteration.island}</strong>
                    </span>
                  )}
                  {generation != null && (
                    <span className="tag generation-chip">
                      generation: <strong>{generation}</strong>
                    </span>
                  )}
                </div>
              )}
              {iteration.tags.length > 0 && (
                <div className="detail-tags">
                  {iteration.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="detail-header-compact-title" ref={containerRef}>
                <BackLink compact />
                <span className="compact-title-text" ref={titleRef}>
                  #{iteration.id} {iteration.title ?? ""}
                </span>
                {firstMetric && firstMetricMeta && (
                  <span className="compact-metric" ref={metricRef}>
                    <span className="chip-key" title={abbrMetric ? firstMetricLabel : undefined}>
                      {abbrMetric ? firstMetricAbbr : firstMetricLabel}
                    </span>
                    <span className="chip-val">{formatMetric(firstMetric[1], firstMetricMeta)}</span>
                    <span className="compact-metric-ghost" aria-hidden ref={fullGhostRef}>
                      {firstMetricLabel}
                    </span>
                    <span className="compact-metric-ghost" aria-hidden ref={abbrGhostRef}>
                      {firstMetricAbbr}
                    </span>
                  </span>
                )}
                <span className="compact-top" ref={topRef}>
                  <BackToTop />
                </span>
              </div>
            </>
          )}
        </div>
      </header>
      {iteration && (
        <div className="detail-body">
          <h2>Metrics</h2>
          <details className="table-settings-fold">
            <summary>Table settings</summary>
            <MetricFilter
              run={run}
              bases={metricBases}
              groups={metricGroups}
              selectedBases={selectedBases}
              selectedGroups={selectedGroups}
              onBasesChange={setSelectedBases}
              onGroupsChange={setSelectedGroups}
              basesOrder={basesOrder}
              groupsOrder={groupsOrder}
              onBasesOrderChange={setBasesOrder}
              onGroupsOrderChange={setGroupsOrder}
              settings={
                <>
                  <PillToggle checked={separateMetricSections} onChange={setSeparateMetricSections}>
                    Separate sections
                  </PillToggle>
                  <PillToggle checked={interleaveMetrics} onChange={setInterleaveMetrics}>
                    Interleave
                  </PillToggle>
                </>
              }
            />
          </details>
          <div className="metrics-table-scroll">
          <table className="metrics-table">
            <thead>
              <tr>
                <th />
                <th className="metric-value metric-this">this</th>
                <th className="metric-delta-head">delta</th>
                <th className="metric-value metric-compare-head">
                  <select
                    className="compare-select"
                    aria-label="Compare against"
                    value={compareTargetId}
                    onChange={(e) => setCompareTarget(e.target.value)}
                  >
                    {parentIteration && <option value={PARENT}>parent</option>}
                    <option value={MEAN}>mean</option>
                    {compareOptions.map((it) => (
                      <option key={it.id} value={it.id}>
                        #{it.id}
                        {it.id === baselineIteration?.id ? " (baseline)" : ""}
                        {it.title ? ` · ${it.title}` : ""}
                      </option>
                    ))}
                  </select>
                </th>
              </tr>
            </thead>
            <tbody>
              {tableSections.flatMap((section) => {
                const rows = section.keys
                  .filter((key) => key in iteration.metrics)
                  .map((key) => {
                    const value = iteration.metrics[key];
                    const meta = metricMeta(run, key);
                    const compareValue = resolveCompareValue(key);
                    return (
                      <tr key={key}>
                        <td className="metric-name">{metricLabel(run, key)}</td>
                        <td className="metric-value metric-this">{formatMetric(value, meta)}</td>
                        <td className="metric-delta">
                          <MetricDelta value={value} baseline={compareValue} meta={meta} />
                        </td>
                        <td className="metric-value metric-baseline metric-compare">
                          {compareValue !== undefined ? formatMetric(compareValue, meta) : "—"}
                        </td>
                      </tr>
                    );
                  });
                if (rows.length === 0) return [];
                if (section.label) {
                  return [
                    <tr key={`sep-${section.id}`} className="metric-section-separator">
                      <td colSpan={4}>{section.label}</td>
                    </tr>,
                    ...rows,
                  ];
                }
                return rows;
              })}
              {chartedMetrics.length === 0 &&
                Object.entries(iteration.metrics).map(([key, value]) => {
                  const meta = metricMeta(run, key);
                  const compareValue = resolveCompareValue(key);
                  return (
                    <tr key={key}>
                      <td className="metric-name">{metricLabel(run, key)}</td>
                      <td className="metric-value metric-this">{formatMetric(value, meta)}</td>
                      <td className="metric-delta">
                        <MetricDelta value={value} baseline={compareValue} meta={meta} />
                      </td>
                      <td className="metric-value metric-baseline metric-compare">
                        {compareValue !== undefined ? formatMetric(compareValue, meta) : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>

          {iteration.description && (
            <>
              <h2>Description</h2>
              <div className="description-card">
                <MarkdownView content={iteration.description} />
              </div>
            </>
          )}

          {artifactEntries.length > 0 && (
            <>
              <h2>Artifacts</h2>
              <ArtifactToc
                entries={artifactEntries}
                onSelect={focusArtifact}
                wrap={wrap}
                onWrapChange={setWrap}
              />
              {artifactEntries.map(({ artifact, anchorId }) => (
                <ArtifactSection
                  key={anchorId}
                  iterationId={iteration.id}
                  datadir={datadir ?? ""}
                  artifact={artifact}
                  anchorId={anchorId}
                  collapsed={collapsed[anchorId] ?? true}
                  wrap={wrap}
                  onToggle={() => toggleArtifact(anchorId)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
