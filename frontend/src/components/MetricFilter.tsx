import type { ReactNode } from "react";
import type { RunMeta } from "../api/types";
import { groupLabel, metricBaseLabel, metricSetBases, reconcileOrder, type MetricGroup } from "../format";
import { SortablePills } from "./SortablePills";
import SectionCard, { type CardSection } from "./SectionCard";

/** dnd-kit ids are strings; map the `null` "General" group prefix to a sentinel. */
const GENERAL_GROUP_KEY = "__general__";
const groupKey = (prefix: string | null) => prefix ?? GENERAL_GROUP_KEY;

interface MetricFilterProps {
  run: RunMeta | null;
  /** Distinct base metric names (the single pill selection). */
  bases: string[];
  /** Prefix groups present in the data (drives the Groups selector). */
  groups: MetricGroup[];
  /** Currently selected base metric names. */
  selectedBases: string[];
  /** Currently selected prefix groups (null = the unprefixed "General" group). */
  selectedGroups: (string | null)[];
  onBasesChange: (bases: string[]) => void;
  onGroupsChange: (groups: (string | null)[]) => void;
  /** Display order of all base metrics (drag-authored). */
  basesOrder: string[];
  /** Display order of all prefix groups (drag-authored). */
  groupsOrder: (string | null)[];
  onBasesOrderChange: (order: string[]) => void;
  onGroupsOrderChange: (order: (string | null)[]) => void;
  /** Optional view settings rendered alongside the preset dropdown under Display. */
  settings?: ReactNode;
}

/** Order-insensitive set equality. */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((key) => set.has(key));
}

/**
 * One flat base-metric pill selection plus an orthogonal Groups selector (which
 * prefix variants to show); charts render the present cross-product. Both pill
 * rows are drag-reorderable; the order syncs across pages via the same
 * sessionStorage keys as the on/off selection. The Display section holds the
 * metric-set preset dropdown and any per-tab view settings.
 */
export default function MetricFilter({
  run,
  bases,
  groups,
  selectedBases,
  selectedGroups,
  onBasesChange,
  onGroupsChange,
  basesOrder,
  groupsOrder,
  onBasesOrderChange,
  onGroupsOrderChange,
  settings,
}: MetricFilterProps) {
  const presets = run?.metricSets ?? {};
  const presetNames = Object.keys(presets);
  const prefixes = groups.map((group) => group.prefix);
  const baseSet = new Set(selectedBases);
  const groupSet = new Set(selectedGroups);

  // Reconcile the stored order against the present items each render, so a
  // pill never goes missing for a frame when the metric set changes (the shell
  // reconciles too, but this keeps the row self-contained and race-free).
  const orderedBases = reconcileOrder(basesOrder, bases);
  const orderedPrefixes = reconcileOrder(groupsOrder, prefixes);

  const toggleBase = (base: string) => {
    const next = new Set(baseSet);
    if (next.has(base)) next.delete(base);
    else next.add(base);
    onBasesChange(bases.filter((b) => next.has(b)));
  };

  const toggleGroup = (prefix: string | null) => {
    const next = new Set(groupSet);
    if (next.has(prefix)) next.delete(prefix);
    else next.add(prefix);
    onGroupsChange(prefixes.filter((p) => next.has(p)));
  };

  const applyPreset = (entries: string[]) => onBasesChange(metricSetBases(entries, bases));

  // The preset whose base names match the current base selection, else "" (Custom).
  const activePreset =
    Object.entries(presets).find(([, entries]) => sameSet(metricSetBases(entries, bases), selectedBases))?.[0] ?? "";

  const metricsBody = (
    <SortablePills
      items={orderedBases}
      selected={baseSet}
      getKey={(base) => base}
      renderLabel={(base) => metricBaseLabel(run, base)}
      onToggle={toggleBase}
      onReorder={onBasesOrderChange}
    />
  );

  const groupsBody = (
    <SortablePills
      items={orderedPrefixes}
      selected={groupSet}
      getKey={groupKey}
      renderLabel={(prefix) => groupLabel(run, prefix)}
      onToggle={toggleGroup}
      onReorder={onGroupsOrderChange}
    />
  );

  const displayBody = (
    <>
      {presetNames.length > 0 && (
        <span className="preset-filter">
          <svg className="preset-filter-icon" viewBox="0 0 16 16" aria-hidden>
            <path
              d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <select
            className="preset-select"
            value={activePreset}
            onChange={(event) => {
              const name = event.target.value;
              if (name) applyPreset(presets[name]);
            }}
          >
            <option value="" disabled>
              Custom
            </option>
            {presetNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </span>
      )}
      {presetNames.length > 0 && settings && <span className="preset-divider" aria-hidden />}
      {settings}
    </>
  );

  const sections: CardSection[] = [{ label: "Metrics", body: metricsBody }];
  // The Groups selector only earns its space when prefixed variants exist.
  if (prefixes.length > 1) sections.push({ label: "Groups", body: groupsBody });
  if (presetNames.length > 0 || settings) {
    sections.push({ label: "Display", body: displayBody, bodyClassName: "section-card-settings" });
  }

  return <SectionCard className="metric-filter" sections={sections} />;
}
