import { useState } from "react";
import { sendMessage } from "./api";
import { Message } from "./components/Message";
import "./styles.css";

function newSessionId() {
  return `s-${crypto.randomUUID().slice(0, 8)}`;
}

export default function App() {
  // A page refresh intentionally starts a new conversation session.
  const [sessionId] = useState(newSessionId);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!message.trim() || sending) return;
    const text = message.trim();
    setMessage("");
    setError("");
    setMessages((current) => [...current, { role: "user", content: text }]);
    setSending(true);
    try {
      // Send only the new message; the backend owns the conversation history.
      const response = await sendMessage({
        session_id: sessionId,
        message: text,
        ...(systemPrompt.trim() ? { system_prompt: systemPrompt.trim() } : {}),
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.reply, metadata: response.metadata },
      ]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="chat-card">
        <header>
          <div>
            <p className="eyebrow">LYFAI / PRIVATE CHAT</p>
            <h1>Think out loud.</h1>
            <p className="subtitle">A resilient AI workspace with transparent answers.</p>
          </div>
          <span className="status-dot">● online</span>
        </header>
        <label className="prompt-label">
          System prompt <span>optional</span>
          <input
            data-testid="system-prompt-input"
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            placeholder="Shape the assistant's voice..."
          />
        </label>
        <div className="conversation">
          {messages.length === 0 && (
            <div className="empty-state">
              <span>✦</span>
              <p>Ask anything to start a new session.</p>
            </div>
          )}
          {messages.map((item, index) => <Message key={index} message={item} />)}
          {sending && <div className="typing">Thinking<span>...</span></div>}
          {error && <div className="error-message">{error}</div>}
        </div>
        <form className="composer" onSubmit={submit}>
          <textarea
            data-testid="chat-input"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write a message..."
            rows="1"
            disabled={sending}
          />
          <button data-testid="send-button" type="submit" disabled={sending || !message.trim()}>
            {sending ? "..." : "Send ↗"}
          </button>
        </form>
        <footer>Session {sessionId} · Your conversation is stored locally by the API.</footer>
      </section>
    </main>
  );
}
