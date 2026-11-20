import ReactMarkdown from "react-markdown";

export function Message({ message }) {
  if (message.role === "user") {
    return <div className="message user-message">{message.content}</div>;
  }

  const metadata = message.metadata;
  return (
    <article className="message assistant-message" data-testid="assistant-message">
      <div className="markdown-content">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      {metadata && (
        <div className="metadata">
          <span data-testid="meta-source">{metadata.resolution_source}</span>
          <span data-testid="meta-model">{metadata.model}</span>
          <span data-testid="meta-latency">{metadata.latency_ms} ms</span>
          <span data-testid="meta-input-tokens">{metadata.input_tokens}</span>
          <span data-testid="meta-output-tokens">{metadata.output_tokens}</span>
        </div>
      )}
    </article>
  );
}
