import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../util";

interface PillToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  /** Whether the pill is on. */
  checked: boolean;
  /** Toggle the pill. */
  onChange: (checked: boolean) => void;
  /** Pill label. */
  children: ReactNode;
}

/**
 * Pill-shaped on/off toggle; the whole pill recolors by state (replaces
 * checkboxes). Forwards its ref and spreads any extra button attributes, so
 * `SortablePills` can wire `@dnd-kit` drag listeners/transforms onto the same
 * element that toggles on click.
 */
const PillToggle = forwardRef<HTMLButtonElement, PillToggleProps>(
  ({ checked, onChange, onClick, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn("pill", checked && "on", className)}
      aria-pressed={checked}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onChange(!checked);
      }}
      {...rest}
    >
      {children}
    </button>
  ),
);

PillToggle.displayName = "PillToggle";

export default PillToggle;
