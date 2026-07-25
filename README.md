# SearchDash

A live, read-only web dashboard for watching iterative experiment progress. Point it at a directory of per-iteration artifacts and it charts score progressions, lists every change with its metrics, drills into full detail (markdown description, GitHub-style diffs, syntax-highlighted code), filters which metrics are charted, builds ad-hoc scatter plots of any two metrics, and visualizes the iteration DAG as a graph.

The dashboard is **read-only**: it only reads the artifact directory produced by autoresearch-style experiments, OpenEvolve-style evolutionary search, or any other process that emits per-iteration records.

> **Local use only.** searchdash is built for local research on a host you control. The server binds to `127.0.0.1` with **no authentication, authorization, or TLS**, so any process on the machine can read (read-only) every file under `--root` through the API. Datadir and artifact paths are theoretically confined to `--root` (symlinks and `..` are resolved before the confinement check) but security gaps are very likely.

## Quick Start

From the repo root:

```bash
uv run searchdash example
```

This builds the frontend on first run (needs `npm`), auto-picks the first free port from `8123` upward, and opens a browser. Launch a second instance and it auto-picks the next free port — instances coexist.

A single searchdash instance can serve every datadir under a root directory, selectable via the home picker or bookmarkable `?datadir=` URLs (paths are relative to `--root`).

### Options

| Flag | Default | Meaning |
| --- | --- | --- |
| `<datadir>` | — | Artifact directory to serve (optional). Omit to land on the home picker; provide to open that dashboard directly. |
| `--root` | cwd | Confines browsing and datadir resolution to this subtree. A datadir outside root is rejected. |
| `--port` | (auto) | Port to serve on (the one you open). Omit to auto-pick a free port scanning upward from `8123`. **Provide an explicit value to pin that exact port** — fails loudly if busy (no silent scan). In dev mode (`--dev`), the port is the browser UI port; the API runs on `port+1` (both required exactly when pinned, both auto-picked when omitted). |
| `--dev` | off | Run the Vite dev server with HMR; the API runs in a background thread and `/api` is proxied to it. |
| `--interval` | `5.0` | Default client poll interval, in seconds (adjustable live in the UI). |
| `--rebuild` | off | Force a frontend rebuild before serving (prod only). |
| `--run-config` | — | Fallback `run` record (JSON or YAML) reused when a datadir has none of its own. |
| `--no-default-config` | off | Disable the bundled `default_run.yaml` (see below). Pass this to get bare inferred defaults with no preset metric labels/sets. |

## Artifact Format (The `<datadir>` Contract)

```
<datadir>/
  run.yaml                  # OPTIONAL run-level metadata (.yaml, .yml, or .json)
  iterations/
    0001/
      iteration.yaml        # REQUIRED per-iteration record (.yaml, .yml, or .json)
      changes.diff          # OPTIONAL unified diff (rendered GitHub-style)
      program.py            # OPTIONAL code artifact
      ...                   # any other nested files referenced by the record
    0002/
      ...
```

Both record files may be written as YAML (`.yaml`/`.yml`) or JSON (`.json`); the parser branches on the extension. Markdown prose in `description`/`summary` renders as a readable `|` block scalar rather than an escaped one-line string. If both formats exist for the same stem, YAML wins and the shadowed file is logged as a warning.

### `iterations/<id>/iteration.yaml` (or `.json`)

```yaml
id: "0001"
parent: "0000"
timestamp: "2026-06-09T12:00:00Z"
title: Log-transform the time head
summary: short one-liner (markdown ok)
description: |
  longer markdown for the detail page
metrics:
  composite: 0.82
  regret: 0.11
  mae_time_s: 1.3
island: 2
inspirations: ["0000", "0003"]
artifacts:
  - type: diff
    path: changes.diff
    label: Change diff
  - type: code
    path: program.py
    label: Program
    language: python
  - type: file
    path: config.yaml
    label: Config
    language: yaml
tags: ["optional"]
```

- `id` may be omitted — it defaults to the subdirectory name.
- `metrics` is the only field the charts truly need; everything else is for the list and detail views.
- `parent` (optional string) — id of the parent iteration this one derived from. Determines lineage edges in the graph view and vertical position (generation depth).
- `island` (optional int, default `null`) — island or sub-population this program belongs to in MAP-Elites quality-diversity evolution. The graph view colors nodes by island; `null` renders neutral gray.
- `inspirations` (optional list of iteration-id strings, default empty) — iterations that provided context to the LLM when generating this one. The graph view renders these as dashed edges, hidden by default behind a "Show inspiration edges" toggle (they are dense).
- Artifact `path` is **relative to the iteration subdir**. The server refuses any path escaping it.
- Artifact `type` is one of `diff` (unified-diff render), `code` / `file` (syntax-highlighted).

### `run.yaml` (or `.json`, Optional)

```yaml
name: LCM routing
metrics:
  composite:
    label: Composite
    higherIsBetter: true
    format: .3f
  regret:
    label: Regret
    higherIsBetter: false
metricSets:
  Default:     ["composite", "regret"]
  Routing:     ["composite", "regret", "constraint"]
  Predictions: ["mae_time_s", "rmse", "r2"]
defaultMetricSet: Default
totals:
  - metric: composite
    label: Iterations
    aggregation: count
    format: d
    unit: " it"
    unitPosition: suffix
  - value: 312.40
    label: API Cost
    format: .2f
    unit: "$"
    unitPosition: prefix
```

**Base-name metric definitions.** The `metrics` map may be keyed by the **base name** of a metric (e.g. `composite`) rather than every prefixed variant. The prefix is the substring before the first `.`: `train.composite` and `val.composite` have base name `composite`; an unprefixed key like `composite` is its own base name. Any prefixed variant found in iteration data inherits `label`, `format`, and `higherIsBetter` from the base-name entry. An explicit full-key entry (e.g. `"val.regret": {...}`) overrides the inherited value for that specific key. Lookup order: exact full key → base name.

**`metricSets` are authored by base name** and select those base metrics. A set entry `"composite"` selects the `composite` base metric; which prefixed variants (`train.composite`, `val.composite`, …) actually chart is governed independently by the Groups selector (see UI tabs). Full-key entries are tolerated and reduced to their base name. No backend change: the server serves base-name `run.metrics` and prefixed iteration metrics as-is; prefix resolution is purely client-side.

**Group display names.** The `run.yaml` may include a `groups` map keyed by metric prefix (use `""` for the unprefixed/"General" group):

```yaml
groups:
  "":      { label: General }
  train:   { label: Train }
  val:     { label: Validation }
```

Each entry carries an optional `label` that replaces the raw prefix string in section headers, group pills, and per-chart tags. The reserved key `""` names the unprefixed group (default display name `"General"` when no entry is present).

**Bundled default config and deep-merge precedence.** A (generic) `default_run.yaml` is shipped inside the package with some defaults: metric definitions (labels, formats, `higherIsBetter`, sort order), `metricSets`, `defaultMetricSet`, `groups`, and a count-all total. It acts as the base layer deep-merged under any per-datadir record:

1. Bundled `default_run.yaml` (unless `--no-default-config`)
2. Deep-merged with `<datadir>/run.{json,yaml,yml}` (if present) or `--run-config` fallback (if given) — the per-datadir record wins per key. Dict values are merged recursively; scalars and lists (including `totals`) are replaced wholesale when the override defines them.
3. If neither default nor any record is present, defaults are inferred: metric keys = union across all iterations, a single `All` metric set, no `higherIsBetter` coloring.

Pass `--no-default-config` to skip the bundled default entirely and revert to bare inferred defaults or a plain `--run-config`. When using this repo for many experiments it can be nice to adapt the default to the situation at hand.

**`totals`** (optional, default empty) — run-level rollups rendered as a full-width "Totals" card on the Progress tab. Each entry is one of three flavors:

- **Aggregated** (`metric` set): combines a per-iteration metric across all iterations. Fields: `metric` (key from iteration `metrics`), optional `label` (falls back to metric's label then key), `aggregation` (`sum` | `mean` | `max` | `min` | `last` | `count`; default `sum`; `count` counts iterations with the metric present, ignoring values), optional `format` (Python float spec, falls back to metric's `format`). Value aggregations also render a min/median/mean/max distribution line on the tile.
- **Static** (`value` set): a standalone run-level figure entered directly in `run.yaml` — e.g. total cluster cost tallied after the run, not derived from any per-iteration metric. Fields: `value` (the number, shown verbatim), `label` (**required** — no metric key to fall back to), optional `format`. No aggregation, no distribution line.
- **Count-all** (neither `metric` nor `value` set): counts every iteration regardless of which metrics it carries — useful as a simple "Iterations" total that stays accurate even when metrics vary across iterations. Requires `aggregation: count` and `label`. Example: `{ label: Iterations, aggregation: count }`. Renders `iterations.length` with a count chip; no distribution line.

At most one of `metric` / `value` may be set per entry. Empty list hides the card.

Both flavors also accept an optional `unit` (string attached verbatim to the displayed value — include any spacing yourself, e.g. `"$"` or `" USD"`) and `unitPosition` (`prefix` → `$312.40`, or `suffix` → `312.40 USD`; default `suffix`). The unit decorates the main tile value only, not the distribution line.

## API

All routes are read-only and re-scan the directory per request (payloads are small, so no caching).

| Route | Returns |
| --- | --- |
| `GET /api/config` | Client defaults: `{ pollIntervalMs, root, initialDatadir }`. `initialDatadir` is root-relative. |
| `GET /api/run?datadir=<path>` | Resolved run metadata for the specified datadir. |
| `GET /api/iterations?datadir=<path>` | All iteration records (metrics + meta, no artifact contents), sorted by id. |
| `GET /api/iterations/{id}?datadir=<path>` | One full record including its artifact descriptors. |
| `GET /api/iterations/{id}/artifact?datadir=<path>&path=...` | Raw artifact bytes; the path is sanitized to the iteration subdir. |
| `GET /api/browse?path=<partial>` | List of `{ path, name, isDatadir }` child directories for path autocomplete. `path` is root-relative. Confined to root. |
| `GET /api/validate?datadir=<path>` | Validation: `{ valid, isDatadir, name }`. |

All data routes (`/api/run`, `/api/iterations`, `/api/iterations/{id}`, `/api/iterations/{id}/artifact`) require a `datadir` query param (root-relative path; backend also accepts absolute paths confined under root). Missing → 422, outside root → 400, not a directory → 404. The backend `DatadirResolver` emits only root-relative paths.

## Dev vs Prod

- **Prod (default)**: if `frontend/dist/` is missing (or `--rebuild` is passed), runs `npm install` (when `node_modules` is absent) then `npm run build`. A single uvicorn process then serves the API plus the prebuilt bundle on the chosen port.
- **Dev (`--dev`)**: runs the API in a background thread and spawns `npm run dev` for the UI with HMR. `--port` pins the UI port (the one you browse); the API runs on `port+1`. Omit `--port` to auto-pick both: the UI from `8123`, the API from `UI+1`. Both ports must be free (Vite uses `--strictPort`). The API port is passed via `API_PORT` so Vite proxies `/api`.

## UI Tabs

- **Home picker** (at `/` when no datadir is selected) — path input with directory autocomplete (confined to `--root`, supports Tab to fill highlighted/first suggestion) and a "Recent" section showing recently opened datadirs (stored per-origin in localStorage, live-synced across all open tabs). Select an experiment to navigate to its dashboard. Datadir-open failures appear as floating toast notifications (bottom-right, auto-dismiss).
- **Progress** — line charts of metric progressions over iteration id. Metric selection is two orthogonal pill rows: **Metrics** picks base metrics once (one pill per base name, no prefix duplication), and **Groups** picks which prefix variants to show (`General` = unprefixed, plus `train`, `val`, … — shown only when prefixed variants exist; group pill labels come from `run.groups`). The charts render the present cross-product of selected bases × groups. Both pill rows are drag-reorderable; the new order syncs across Progress, Graph, and Detail via sessionStorage (the same mechanism as the on/off selection), reflowing Progress charts and iteration-table columns, Graph node metric rows, and Detail metrics-table rows. Metric-set presets (which drive the base selection) live in the Display section of the same card. By default, charts are **separated by prefix**: every group (including the unprefixed "General" group) gets its own full-width foldable section, headed by a clickable disclosure row showing the group's display label. Click a section header to fold/hide its charts; state persists in sessionStorage (`evo.foldedSections`). Chart titles inside a section show the bare base label. The **"Separate sections"** toggle (Display section) merges everything into one flowing grid, where each chart shows a small prefix tag before its title instead. The **"Interleave"** toggle (Display section, only active when "Separate sections" is on) reorders charts base-major (`met_A, val.met_A, met_B, val.met_B, …`) — one foldable section per base metric — instead of the default group-major order. Interleave state persists in sessionStorage (`evo.interleaveMetrics`). Labels, formatting, and good/bad coloring are inherited from the base-name definition in `run.yaml`. The "Color by island" toggle splits each line into per-island colored trajectories (off = single accent color). Hover any point in one chart to highlight that same iteration (filled marker + id card) in all sibling charts. Above the charts, an optional full-width **Totals** card displays run-level rollups (sum, mean, max, min, last, or count) of specified metrics across all iterations, controlled by the `totals` block in `run.yaml`. Header shows the current datadir (click to edit and switch experiments in-place). Zoom/pan state persists across tab switches.
- **Scatter** — ad-hoc scatter plots. Pick any two metrics as X/Y axes; points are iterations, hover shows details. The "Color by island" toggle colors points by island (off = single accent color). The **Fit** toggle overlays a least-squares regression line. The **Frontier** toggle (off by default) overlays the Pareto frontier as a staircase line plus a shaded dominated-region fill; it respects each metric's `higherIsBetter` direction (including mixed axes, e.g. maximize X / minimize Y), defaulting to higher-is-better when unset. Hover any point in one scatter card to highlight that same iteration (filled marker + id card) in all sibling cards. Zoom/pan state persists across tab switches.
- **Graph** — iteration DAG. Nodes represent iterations, colored by island (or neutral gray for `null`). Solid edges = parent lineage (`parent` field); dashed edges = LLM inspirations (`inspirations` field, toggled via "Show inspiration edges"). Vertical position = generation (parent-chain depth, computed client-side). Nodes render the currently selected metric values directly (shared with Progress tab's metric filter); changing the selection on either tab updates both. Metric labels on nodes are prefix-aware: `train.composite` renders as `train · Composite` (explicit full-key label in `run.yaml` still wins). Good/bad coloring is inherited from the base-name definition. Click opens the detail page. Built on React Flow (`@xyflow/react`) + dagre layout (`@dagrejs/dagre`).
- **Detail page** — full iteration record: title, description (markdown), metrics table, artifacts (diffs, code). The metrics table is four columns: `metric | this | <compare-select> | delta`. The compare-select is a header dropdown picking the comparison target: **parent** (only when the iteration has a `parent`; follows the currently-viewed iteration's parent rather than pinning a fixed id), then **mean** (all-iteration mean), then any iteration as `#<id>` (baseline marked `(baseline)`, title appended). Default target is **parent → baseline → mean** — parent when one exists, else the baseline (root iteration with no `parent`, ties broken by smallest id), else mean; an explicit choice persists across navigation between detail pages (not saved to storage). The delta column carries a `delta` header; the pill shows percentage change of this vs the selected target, colored good/bad per `higherIsBetter` (arrow = this's direction, good when this improved). A generation chip (parent-chain depth, root=0) appears alongside the island chip.

The URL is the single source of truth for the current experiment: dashboard at `/?datadir=<root-relative path>`, detail at `/iteration/<id>?datadir=<root-relative path>`. These are bookmarkable.

## Architecture & Modularity

Three seams are deliberately swappable:

- **Charts** — the dashboard imports only from `frontend/src/charts/` (`LineChartView`, `ScatterChartView`), typed by `charts/types.ts`. No Plotly.js type escapes that folder. Swap libraries by adding `charts/<lib>/` and flipping the re-export in `charts/index.ts` (Plotly.js replaced Recharts to gain ClearML-style zoom/pan: drag axis-middle to pan, drag axis-end to scale, click-drag for zoom, double-click reset). The Plotly views share hover-link, zoom-persistence, and layout logic through small helper modules (`hoverLink.ts`, `zoomStore.ts`, `layout.ts`, `useChartTheme.ts`) rather than duplicating. Both line and scatter are hover-linked (hover a point in one chart to highlight that iteration in all sibling charts). Zoom persists across tab switches via a module-level `zoomStore` keyed by a stable `viewId`.
- **Graph** — the DAG view lives in `frontend/src/graph/` (`GraphView`), typed by `graph/types.ts`. No React Flow type escapes that folder. Swap libraries by adding `graph/<lib>/` and updating `graph/index.ts`.
- **Data source** — every network call lives in `frontend/src/api/client.ts` against the domain types in `api/types.ts`. Swap the backend (e.g. to static files) by rewriting that one module.

Shared frontend modules kill duplication: `components/{Status,MetricChip,IterationHeader,NavButtons,Tabs}.tsx` (11+ callsites consolidated), `hooks/useAsyncData.ts` (stale-safe fetch-on-mount), `hooks/useToast.tsx` (macOS-style floating toast notifications via `ToastProvider`/`useToast`, wraps `App` in `main.tsx`), `hooks/useRecentDatadirs.ts` (shared module-level store via `useSyncExternalStore`, live-synced across tabs), `util.ts` (class-name join + detail-route builder), `charts/islands.ts` (island grouping for both chart views), `islandColor.ts` (consistent island→color across charts+graph). CSS design tokens in `styles.css` (`:root` radius/spacing/type/weight/motion/effects scales) enforce single-source-of-truth theming via `var(...)`.
