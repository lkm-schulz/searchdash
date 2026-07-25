import type { ReactNode } from "react";
import { cn } from "../util";

/** One labelled row in a SectionCard: a body of controls and a right-aligned
 *  uppercase label naming it. */
export interface CardSection {
  /** Short label shown to the right of the row. */
  label: string;
  /** Row content (toggles, links, …). */
  body: ReactNode;
  /** Extra class on the body wrapper (e.g. for a wider settings gap). */
  bodyClassName?: string;
}

/** Card of labelled sections, each a body with a right-aligned label. Shared by
 *  the metric filter and the detail-page artifact card so both read identically. */
export default function SectionCard({
  sections,
  className,
}: {
  sections: CardSection[];
  className?: string;
}) {
  return (
    <div className={cn("section-card", className)}>
      {sections.map(({ label, body, bodyClassName }) => (
        <section key={label} className="section-card-section">
          <div className={cn("section-card-body", bodyClassName)}>
            {body}
          </div>
          <span className="section-card-label">{label}</span>
        </section>
      ))}
    </div>
  );
}
