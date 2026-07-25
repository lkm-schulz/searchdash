import PillToggle from "./PillToggle";

interface IslandToggleProps {
  /** Whether island coloring is on. */
  checked: boolean;
  /** Toggle island coloring. */
  onChange: (checked: boolean) => void;
}

/** Shared pill toggling per-island coloring on the Progress and Scatter tabs. */
export default function IslandToggle({ checked, onChange }: IslandToggleProps) {
  return (
    <PillToggle checked={checked} onChange={onChange}>
      Color by island
    </PillToggle>
  );
}
