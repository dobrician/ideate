import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SIMPLE_ALLOWED = new Set(["p", "strong", "em", "code", "a", "del"]);

type Props = { content: string; className?: string; simple?: boolean };

export function MarkdownRenderer({ content, className, simple }: Props) {
  return (
    <div className={`prose dark:prose-invert prose-sm max-w-none overflow-x-auto break-words ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={simple ? [...SIMPLE_ALLOWED] : undefined}
        unwrapDisallowed={simple}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
