import Markdown from "react-markdown";

interface MarkdownViewProps {
  content: string;
}

/** Thin wrapper rendering markdown content. */
export default function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div className="markdown">
      <Markdown>{content}</Markdown>
    </div>
  );
}
