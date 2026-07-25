import { Diff, Hunk, parseDiff } from "react-diff-view";
import "react-diff-view/style/index.css";

interface DiffViewProps {
  diffText: string;
}

/** GitHub-style unified-diff renderer. */
export default function DiffView({ diffText }: DiffViewProps) {
  const files = parseDiff(diffText);
  if (files.length === 0) {
    return <pre className="raw-diff">{diffText}</pre>;
  }
  return (
    <div className="diff">
      {files.map((file, index) => (
        <Diff
          key={file.oldRevision + file.newRevision + index}
          viewType="unified"
          diffType={file.type}
          hunks={file.hunks}
        >
          {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
        </Diff>
      ))}
    </div>
  );
}
