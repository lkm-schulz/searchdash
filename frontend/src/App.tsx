import { useEffect, useMemo, useRef } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { useRunData } from "./hooks/useRunData";
import { useConfig } from "./hooks/useConfig";
import { useDatadir } from "./hooks/useDatadir";
import { useSessionState } from "./hooks/useSessionState";
import { usePolling } from "./hooks/usePolling";
import { useTheme, type Theme } from "./hooks/useTheme";
import {
  groupMetricKeys,
  metricBaseNames,
  metricSetBases,
  reconcileOrder,
  reorderGroups,
  selectMetricKeys,
} from "./format";
import { dashboardPath } from "./util";
import ProgressTab from "./components/ProgressTab";
import ScatterTab from "./components/ScatterTab";
import GraphTab from "./components/GraphTab";
import type { ScatterCardConfig } from "./components/ScatterPlotCard";
import RefreshControls from "./components/RefreshControls";
import ThemeToggle from "./components/ThemeToggle";
import DatadirEditor from "./components/DatadirEditor";
import Tabs from "./components/Tabs";
import { ErrorBanner, LoadingMessage } from "./components/Status";
import DetailPage from "./pages/DetailPage";
import HomePage from "./pages/HomePage";

type Tab = "progress" | "scatter" | "graph";

const TABS: { id: Tab; label: string }[] = [
  { id: "progress", label: "Progress" },
  { id: "graph", label: "Graph" },
  { id: "scatter", label: "Scatter" },
];

interface DashboardProps {
  datadir: string;
  defaultIntervalMs: number;
  theme: Theme;
  onToggleTheme: () => void;
}

/** Dashboard shell for one datadir: owns tab + per-tab UI state so it survives tab switches. */
function Dashboard({ datadir, defaultIntervalMs, theme, onToggleTheme }: DashboardProps) {
  const data = useRunData(datadir);
  const [tab, setTab] = useSessionState<Tab>("evo.tab", "progress");

  // Publish the sticky header's height so the table header can offset below it
  // (the header wraps at narrow widths, so a fixed value would be wrong).
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty("--app-header-h", `${el.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [intervalMs, setIntervalMs] = useSessionState("evo.intervalMs", 5000);
  const [autoRefresh, setAutoRefresh] = useSessionState("evo.autoRefresh", true);

  // Island coloring on the charts, shared between Progress and Scatter tabs.
  const [colorByIsland, setColorByIsland] = useSessionState("evo.colorByIsland", true);

  // Graph-tab inspiration-edge visibility, lifted so it survives tab switches.
  const [showInspirations, setShowInspirations] = useSessionState("evo.showInspirations", true);

  // Break the Progress charts into per-prefix sections (vs. one flowing grid).
  const [separateMetricSections, setSeparateMetricSections] = useSessionState("evo.separateMetricSections", true);

  // Reorder charts base-major (`met, val.met, …`) instead of group-major.
  const [interleaveMetrics, setInterleaveMetrics] = useSessionState("evo.interleaveMetrics", false);

  // Folded chart-section ids (header shown, charts hidden); shared across tab switches.
  const [foldedSections, setFoldedSections] = useSessionState<string[]>("evo.foldedSections", []);
  const toggleFold = (id: string) =>
    setFoldedSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  // Metric keys grouped by prefix section; the flat key list and the distinct
  // base names derive from it so all orderings stay consistent.
  const metricGroups = useMemo(() => groupMetricKeys(data.run, data.iterations), [data.run, data.iterations]);
  const metricBases = useMemo(() => metricBaseNames(metricGroups), [metricGroups]);

  // User-authored display order for the two orthogonal pill rows (base metrics
  // and prefix groups). Lifted here and mirrored on the detail page via the same
  // sessionStorage keys as the on/off selection, so a drag on one page reflows
  // every metric-ordered surface (charts, table rows, graph node rows, iteration
  // table columns) everywhere. Reconciled against the present metrics below.
  const [basesOrder, setBasesOrder] = useSessionState<string[]>("evo.basesOrder", []);
  const [groupsOrder, setGroupsOrder] = useSessionState<(string | null)[]>("evo.groupsOrder", []);

  // Keep the order arrays in sync with the present metrics: drop entries whose
  // base/group vanished, append newly-appeared ones at the tail (preserving the
  // existing drag order). Also seeds the arrays on first load, and restores a
  // stored order across reloads. Runs on every metric-set change (live polling).
  useEffect(() => {
    setBasesOrder((prev) => reconcileOrder(prev, metricBases));
    setGroupsOrder((prev) => reconcileOrder(prev, metricGroups.map((group) => group.prefix)));
  }, [metricBases, metricGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flat key list in the user's drag order; the canonical groupMetricKeys order
  // is the fallback when an order array is empty (pre-init) or stale.
  const metricKeys = useMemo(
    () => reorderGroups(metricGroups, groupsOrder, basesOrder).flatMap((group) => group.keys),
    [metricGroups, groupsOrder, basesOrder],
  );

  // Selection is two orthogonal sets — which base metrics, and which prefix
  // groups — lifted here so both persist and stay shared across tab switches.
  const [selectedBases, setSelectedBases] = useSessionState<string[]>("evo.selectedBases", []);
  const [selectedGroups, setSelectedGroups] = useSessionState<(string | null)[]>("evo.selectedGroups", []);
  const [selectionInitialized, setSelectionInitialized] = useSessionState("evo.selectionInitialized", false);
  useEffect(() => {
    if (selectionInitialized || metricKeys.length === 0) return;
    const sets = data.run?.metricSets ?? {};
    const defaultName = data.run?.defaultMetricSet ?? Object.keys(sets)[0];
    const defaultEntries = defaultName ? sets[defaultName] : undefined;
    // A bundled default preset may not overlap this datadir's metrics; fall back
    // to all present bases so an unrelated run still shows something.
    const resolved = defaultEntries ? metricSetBases(defaultEntries, metricBases) : metricBases;
    setSelectedBases(resolved.length ? resolved : metricBases);
    setSelectedGroups(metricGroups.map((group) => group.prefix)); // show every group by default
    setSelectionInitialized(true);
  }, [data.run, metricKeys, metricBases, metricGroups, selectionInitialized]);

  // Charts/graph consume the present cross-product of selected bases × groups,
  // in canonical metric-key order.
  const chartedMetrics = useMemo(
    () => selectMetricKeys(metricKeys, selectedBases, selectedGroups),
    [metricKeys, selectedBases, selectedGroups],
  );

  // Scatter-tab cards (full config), lifted here so plots + axis choices persist
  // across tab switches.
  const [scatterCards, setScatterCards] = useSessionState<ScatterCardConfig[]>("evo.scatterCards", []);
  const [nextCardId, setNextCardId] = useSessionState("evo.nextCardId", 0);
  const makeCard = (id: number): ScatterCardConfig => ({
    id,
    xKey: metricKeys[0] ?? "",
    yKey: metricKeys[1] ?? metricKeys[0] ?? "",
    showFit: true,
    showFrontier: false,
  });
  const addCard = () => {
    setScatterCards((prev) => [...prev, makeCard(nextCardId)]);
    setNextCardId((n) => n + 1);
  };
  const updateCard = (id: number, patch: Partial<ScatterCardConfig>) =>
    setScatterCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeCard = (id: number) => setScatterCards((prev) => prev.filter((c) => c.id !== id));

  // Seed one card once metrics are known, mirroring the previous default.
  const [cardsSeeded, setCardsSeeded] = useSessionState("evo.cardsSeeded", false);
  useEffect(() => {
    if (cardsSeeded || metricKeys.length === 0) return;
    setScatterCards([makeCard(0)]);
    setNextCardId(1);
    setCardsSeeded(true);
  }, [metricKeys, cardsSeeded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Adopt the launcher-provided default once it loads.
  useEffect(() => {
    setIntervalMs(defaultIntervalMs);
  }, [defaultIntervalMs]);

  usePolling(data.refresh, intervalMs, autoRefresh);

  return (
    <>
      <div className="top-fade" aria-hidden />
      <header className="app-header" ref={headerRef}>
        <div className="app-header-inner">
          <div className="app-title">
            <DatadirEditor datadir={datadir} runName={data.run?.name ?? "searchdash"} />
          </div>
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          <div className="app-header-controls">
            <RefreshControls
              intervalMs={intervalMs}
              onIntervalChange={setIntervalMs}
              autoRefresh={autoRefresh}
              onAutoRefreshChange={setAutoRefresh}
              onManualRefresh={data.refresh}
              lastUpdated={data.lastUpdated}
            />
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>
      </header>

      <div className="app">
        <ErrorBanner error={data.error} />
      {data.loading ? (
        <LoadingMessage />
      ) : tab === "progress" ? (
        <ProgressTab
          run={data.run}
          iterations={data.iterations}
          bases={metricBases}
          groups={metricGroups}
          metricKeys={metricKeys}
          selectedBases={selectedBases}
          selectedGroups={selectedGroups}
          onBasesChange={setSelectedBases}
          onGroupsChange={setSelectedGroups}
          basesOrder={basesOrder}
          groupsOrder={groupsOrder}
          onBasesOrderChange={setBasesOrder}
          onGroupsOrderChange={setGroupsOrder}
          charted={chartedMetrics}
          colorByIsland={colorByIsland}
          onColorByIslandChange={setColorByIsland}
          separateSections={separateMetricSections}
          onSeparateSectionsChange={setSeparateMetricSections}
          interleave={interleaveMetrics}
          onInterleaveChange={setInterleaveMetrics}
          foldedSections={foldedSections}
          onToggleFold={toggleFold}
        />
      ) : tab === "scatter" ? (
        <ScatterTab
          run={data.run}
          iterations={data.iterations}
          metricKeys={metricKeys}
          cards={scatterCards}
          onAddCard={addCard}
          onUpdateCard={updateCard}
          onRemoveCard={removeCard}
          colorByIsland={colorByIsland}
          onColorByIslandChange={setColorByIsland}
        />
      ) : (
        <GraphTab
          run={data.run}
          iterations={data.iterations}
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
          charted={chartedMetrics}
          showInspirations={showInspirations}
          onShowInspirationsChange={setShowInspirations}
        />
      )}
      </div>
    </>
  );
}

interface RootProps {
  theme: Theme;
  onToggleTheme: () => void;
}

/**
 * The `/` route: dashboard when a `?datadir=` is selected, otherwise the home
 * picker — redirecting to the launcher's initial datadir on first load when one
 * was provided. Waits for the config so the redirect decision is made once.
 */
function Root({ theme, onToggleTheme }: RootProps) {
  const { config, error } = useConfig();
  const datadir = useDatadir();
  const [params] = useSearchParams();

  if (datadir) {
    return (
      <Dashboard
        datadir={datadir}
        defaultIntervalMs={config?.pollIntervalMs ?? 5000}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
    );
  }
  if (error) return <ErrorBanner error={error} />;
  if (!config) return <LoadingMessage />;
  if (config.initialDatadir && !params.has("datadir")) {
    return <Navigate to={dashboardPath(config.initialDatadir)} replace />;
  }
  return <HomePage root={config.root} theme={theme} onToggleTheme={onToggleTheme} />;
}

/** Top-level routes: home picker / dashboard at `/`, and per-iteration detail. */
export default function App() {
  const { theme, toggle } = useTheme();
  return (
    <Routes>
      <Route path="/" element={<Root theme={theme} onToggleTheme={toggle} />} />
      <Route path="/iteration/:id" element={<DetailPage />} />
    </Routes>
  );
}
