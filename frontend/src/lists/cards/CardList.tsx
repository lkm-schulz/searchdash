import type { IterationListProps } from "../types";
import { EmptyState } from "../../components/Status";
import CardListItem from "./CardListItem";

/** Original design: a vertical list of change cards, metrics shown as chips. */
export default function CardList({ run, iterations }: IterationListProps) {
  if (iterations.length === 0) {
    return <EmptyState>No iterations yet.</EmptyState>;
  }
  return (
    <div className="iteration-list">
      {iterations.map((it) => (
        <CardListItem
          key={it.id}
          iteration={it}
          run={run}
        />
      ))}
    </div>
  );
}
