import { Link } from "react-router-dom";
import type { Iteration, RunMeta } from "../../api/types";
import { formatMetric, metricMeta } from "../../format";
import { iterationPath } from "../../util";
import { useDatadir } from "../../hooks/useDatadir";
import IterationHeader from "../../components/IterationHeader";

interface TableRowProps {
  iteration: Iteration;
  run: RunMeta | null;
  metricKeys: string[];
  /** Shared grid template so cells align with the header row. */
  gridTemplate: string;
}

/** One hybrid row: stacked id/title/timestamp on the left, metric cells right. */
export default function TableRow({ iteration, run, metricKeys, gridTemplate }: TableRowProps) {
  const datadir = useDatadir();
  return (
    <div className="table-row">
      <Link
        className="table-row-link"
        style={{ gridTemplateColumns: gridTemplate }}
        to={iterationPath(iteration.id, datadir)}
      >
        <IterationHeader iteration={iteration} variant="table" />
        {metricKeys.map((key) => (
          <div key={key} className="table-cell num">
            {key in iteration.metrics ? formatMetric(iteration.metrics[key], metricMeta(run, key)) : "–"}
          </div>
        ))}
      </Link>
    </div>
  );
}
