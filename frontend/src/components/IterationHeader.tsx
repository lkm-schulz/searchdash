import type { Iteration } from "../api/types";
import { formatDateTime } from "../format";

/** Iteration timestamp line, or nothing when the iteration has no timestamp. */
function IterationTime({ timestamp }: { timestamp?: string | null }) {
  if (!timestamp) return null;
  return <span className="iteration-time">{formatDateTime(timestamp)}</span>;
}

/** Iteration id + title (+ timestamp), laid out for either list design: the card
 *  list (one inline row) or the sortable table (id/title row with the timestamp
 *  stacked beneath, as the table's first grid cell). */
export default function IterationHeader({
  iteration,
  variant,
}: {
  iteration: Iteration;
  variant: "card" | "table";
}) {
  const id = <span className="iteration-id">#{iteration.id}</span>;
  const title = <span className="iteration-title">{iteration.title ?? "(untitled)"}</span>;

  if (variant === "table") {
    return (
      <div className="table-col-info">
        <div className="table-info-head">
          {id}
          {title}
        </div>
        <IterationTime timestamp={iteration.timestamp} />
      </div>
    );
  }

  return (
    <div className="iteration-head">
      {id}
      {title}
      <IterationTime timestamp={iteration.timestamp} />
    </div>
  );
}
