import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { content: string; className?: string };

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={`prose dark:prose-invert prose-sm max-w-none ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
