import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ChatMessageContent({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  if (isUser) {
    return <span className="whitespace-pre-line">{content}</span>;
  }

  return (
    <div className="prose prose-sm max-w-none break-words prose-p:my-0 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 md:prose-lg [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
