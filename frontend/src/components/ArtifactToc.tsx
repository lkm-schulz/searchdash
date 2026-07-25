import type { Artifact } from "../api/types";
import PillToggle from "./PillToggle";
import SectionCard, { type CardSection } from "./SectionCard";

/** One artifact paired with its stable in-page anchor id. */
export interface ArtifactEntry {
  artifact: Artifact;
  anchorId: string;
}

/** Linked table of contents over an iteration's artifacts, plus a Display
 *  section for per-page render settings. Clicking an entry focuses that artifact
 *  (open it, collapse the rest) and scrolls to it. Rendered only when artifacts
 *  exist. */
export default function ArtifactToc({
  entries,
  onSelect,
  wrap,
  onWrapChange,
}: {
  entries: ArtifactEntry[];
  onSelect: (anchorId: string) => void;
  wrap: boolean;
  onWrapChange: (wrap: boolean) => void;
}) {
  const linksBody = (
    <ul className="artifact-toc-links">
      {entries.map(({ artifact, anchorId }) => (
        <li key={anchorId}>
          <button type="button" onClick={() => onSelect(anchorId)}>
            {artifact.label ?? artifact.path}
          </button>
        </li>
      ))}
    </ul>
  );

  const sections: CardSection[] = [
    { label: "Artifacts", body: linksBody },
    {
      label: "Display",
      bodyClassName: "section-card-settings",
      body: (
        <PillToggle checked={wrap} onChange={onWrapChange}>
          Wrap lines
        </PillToggle>
      ),
    },
  ];

  return <SectionCard className="artifact-toc" sections={sections} />;
}
