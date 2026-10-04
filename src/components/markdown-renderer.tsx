import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SIMPLE_ALLOWED = new Set(["p", "strong", "em", "code", "a", "del"]);

type Props = { content: string; className?: string; simple?: boolean; disableLinks?: boolean };

/** Render markdown, optionally removing links when nested in a linked card. */
export function MarkdownRenderer({ content, className, simple, disableLinks }: Props) {
  return (
    <div className={`prose dark:prose-invert prose-sm max-w-none overflow-x-auto break-words ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={simple ? [...SIMPLE_ALLOWED] : undefined}
        unwrapDisallowed={simple}
        components={disableLinks ? { a: ({ children }) => <>{children}</> } : undefined}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
