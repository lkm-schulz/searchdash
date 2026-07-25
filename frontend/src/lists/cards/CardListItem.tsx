import { Link } from "react-router-dom";
import type { Iteration, RunMeta } from "../../api/types";
import { iterationPath } from "../../util";
import { useDatadir } from "../../hooks/useDatadir";
import IterationHeader from "../../components/IterationHeader";
import { MetricChips } from "../../components/MetricChip";

interface CardListItemProps {
  iteration: Iteration;
  run: RunMeta | null;
}

/** A single change row: title, metric chips, timestamp; links to the detail page. */
export default function CardListItem({ iteration, run }: CardListItemProps) {
  const datadir = useDatadir();
  return (
    <div className="iteration-item">
      <Link className="iteration-link" to={iterationPath(iteration.id, datadir)}>
        <IterationHeader iteration={iteration} variant="card" />
        {iteration.summary && <div className="iteration-summary">{iteration.summary}</div>}
        <MetricChips run={run} metrics={iteration.metrics} />
      </Link>
    </div>
  );
}
