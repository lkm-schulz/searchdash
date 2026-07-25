import { Link } from "react-router-dom";
import { useDatadir } from "../hooks/useDatadir";
import { cn, dashboardPath } from "../util";

/** Back-to-dashboard link (preserving the current datadir), shared by the detail
 *  header and the sticky overview bar. The `compact` variant renders just the
 *  arrow (no "Back" label, no button chrome) for the collapsed detail header. */
export function BackLink({ compact = false }: { compact?: boolean }) {
  const datadir = useDatadir();
  return (
    <Link className={cn("back-link", compact && "back-link-compact")} to={dashboardPath(datadir)}>
      {compact ? "←" : "← Back"}
    </Link>
  );
}

/** Smooth-scroll-to-top button. */
export function BackToTop() {
  return (
    <button
      type="button"
      className="back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      ↑ Top
    </button>
  );
}
