import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeViewProps {
  code: string;
  language?: string | null;
}

/** Above this many lines, Prism highlighting blocks the main thread long enough
 *  to be felt on unfold, so the block renders as plain monospace text instead. */
const HIGHLIGHT_LINE_LIMIT = 400;

/** Syntax-highlighted, read-only code block. Large blocks fall back to plain
 *  text to keep unfolding responsive. */
export default function CodeView({ code, language }: CodeViewProps) {
  if (code.split("\n").length > HIGHLIGHT_LINE_LIMIT) {
    return <pre className="code-plain">{code}</pre>;
  }
  return (
    <SyntaxHighlighter
      language={language ?? "text"}
      style={oneDark}
      showLineNumbers
      customStyle={{ margin: 0, borderRadius: "var(--card-inner-radius)", fontSize: 13 }}
    >
      {code}
    </SyntaxHighlighter>
  );
}
