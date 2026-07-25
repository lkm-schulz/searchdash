import { Fragment, useEffect, useMemo, useRef } from "react";
import type { IterationListProps } from "../types";
import { compareByTimestamp, metricLabel } from "../../format";
import { useScrollEdges } from "../../hooks/useScrollEdges";
import { useSessionState } from "../../hooks/useSessionState";
import { EmptyState } from "../../components/Status";
import TableRow from "./TableRow";

const ID_KEY = "__id";

// Render a metric label with a soft break opportunity after each underscore, so
// snake_case headers wrap at word boundaries instead of mid-token.
function labelWithBreaks(label: string) {
  const parts = label.split("_");
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 ? "_" : ""}
      {i > 0 ? <wbr /> : null}
      {part}
    </Fragment>
  ));
}

type SortDir = "asc" | "desc";
interface SortState {
  /** Active sort column: a metric key or the special id column. */
  key: string;
  dir: SortDir;
}

/** Hybrid design: card rows whose metric values align under sortable headers. */
export default function TableList({ run, iterations, metricKeys }: IterationListProps) {
  const [sort, setSort] = useSessionState<SortState>("evo.tableSort", { key: ID_KEY, dir: "asc" });

  // Clicking the active column flips direction; a new column starts ascending
  // for the id and descending for metrics (best-first is the common intent).
  const onSort = (key: string) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === ID_KEY ? "asc" : "desc" },
    );

  const sorted = useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    const rows = [...iterations];
    rows.sort((a, b) => {
      if (sort.key === ID_KEY) return factor * compareByTimestamp(a, b);
      const av = a.metrics[sort.key];
      const bv = b.metrics[sort.key];
      const aMissing = av === undefined;
      const bMissing = bv === undefined;
      if (aMissing && bMissing) return a.id.localeCompare(b.id);
      if (aMissing) return 1; // missing values sink to the bottom regardless of dir
      if (bMissing) return -1;
      return factor * (av - bv);
    });
    return rows;
  }, [iterations, sort]);

  // Fixed metric widths so the separate header and body grids resolve identical
  // tracks and stay aligned; long labels wrap to the column. The info column is
  // minmax(min, 1fr): it absorbs any surplus width (so the last metric sits flush
  // with the table edge) but never shrinks below its base width, scrolling instead.
  const gridTemplate = `minmax(var(--info-col-w), 1fr) repeat(${metricKeys.length}, var(--metric-col-w))`;

  // Body drives horizontal scroll (and the fade affordance); the sticky header
  // is a second scroller mirrored to it so columns track while the page scrolls
  // vertically as normal.
  const { ref: bodyRef, edges } = useScrollEdges<HTMLDivElement>([metricKeys.length, sorted.length]);
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;
    const sync = () => {
      head.scrollLeft = body.scrollLeft;
    };
    sync();
    body.addEventListener("scroll", sync, { passive: true });
    return () => body.removeEventListener("scroll", sync);
  }, [bodyRef]);

  if (iterations.length === 0) {
    return <EmptyState>No iterations yet.</EmptyState>;
  }

  // Reserved indicator slot, always present in a trailing gutter so the label
  // never shifts; shows the active-sort arrow only on the sorted column. Body
  // num cells carry a matching right gutter so numbers stay aligned with the
  // label's right edge (see .sort-indicator / .table-cell.num in styles.css).
  const sortIndicator = (key: string) => (
    <span className="sort-indicator" aria-hidden>
      {sort.key === key ? (sort.dir === "asc" ? "▲" : "▼") : ""}
    </span>
  );

  return (
    <div className="iteration-table">
      <div className="table-head-scroll" ref={headRef}>
        <div className="table-head" style={{ gridTemplateColumns: gridTemplate }}>
          <button className="table-th info sortable" onClick={() => onSort(ID_KEY)}>
            <span>Iteration</span>
            {sortIndicator(ID_KEY)}
          </button>
          {metricKeys.map((key) => (
            <button
              key={key}
              className="table-th num sortable"
              onClick={() => onSort(key)}
              title={metricLabel(run, key)}
            >
              <span>{labelWithBreaks(metricLabel(run, key))}</span>
              {sortIndicator(key)}
            </button>
          ))}
        </div>
      </div>
      <div className="table-body-scroll" ref={bodyRef}>
        <div className="table-body">
          {sorted.map((it) => (
            <TableRow
              key={it.id}
              iteration={it}
              run={run}
              metricKeys={metricKeys}
              gridTemplate={gridTemplate}
            />
          ))}
        </div>
      </div>
      {edges.left && <div className="table-edge-fade left" aria-hidden />}
      {edges.right && <div className="table-edge-fade right" aria-hidden />}
    </div>
  );
}
