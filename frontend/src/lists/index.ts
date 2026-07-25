// Active iteration-list design. Two interchangeable implementations exist for
// A/B testing; flip the re-export below to swap, nothing else changes.
//
//   import { default as IterationListView } from "./cards/CardList";   // original cards
//   import { default as IterationListView } from "./table/TableList";  // hybrid sortable table

export { default as IterationListView } from "./table/TableList";
export type { IterationListProps } from "./types";
