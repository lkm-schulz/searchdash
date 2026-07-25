import type { ReactNode } from "react";

interface ViewControlsProps {
  /** Controls (toggles, buttons) to anchor in the styled bar. */
  children: ReactNode;
}

/** Styled bar that anchors a tab's view options, matching the card system. */
export default function ViewControls({ children }: ViewControlsProps) {
  return <div className="view-controls">{children}</div>;
}
