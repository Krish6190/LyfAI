import { useEffect, useState } from "react";
import { getSessionMessages, sendMessage } from "./api";
import { Message } from "./components/Message";
import { SessionPanel } from "./components/SessionPanel";
import { AppModal } from "./components/AppModal";
import "./styles.css";

function newSessionId() {
  return `s-${crypto.randomUUID().slice(0, 8)}`;
}

function initialSessions(currentId) {
  try {
    const saved = JSON.parse(localStorage.getItem("lyfai-sessions") || "[]");
    return saved.filter((item) => item?.id && item.id !== currentId);
  } catch {
    return [];
  }
}

export default function App() {
  // A page refresh starts a draft session until the first message is sent.
  const [sessionId, setSessionId] = useState(newSessionId);
  const [sessions, setSessions] = useState(() => initialSessions(sessionId));
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [draftId, setDraftId] = useState(sessionId);
  const [draftMessages, setDraftMessages] = useState([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("lyfai-theme") || "dark",
  );
  const [modal, setModal] = useState(null);
  const [activePromptPreset, setActivePromptPreset] = useState("");

  useEffect(() => {
    localStorage.setItem("lyfai-sessions", JSON.stringify(sessions.slice(0, 12)));
  }, [sessions]);

  useEffect(() => {
    const prompts = JSON.parse(localStorage.getItem("lyfai-session-prompts") || "{}");
    prompts[sessionId] = systemPrompt;
    localStorage.setItem("lyfai-session-prompts", JSON.stringify(prompts));
  }, [sessionId, systemPrompt]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("lyfai-theme", theme);
  }, [theme]);

  async function submit(event) {
    event.preventDefault();
    if (!message.trim() || sending) return;
    const text = message.trim();
    setMessage("");
    setError("");
    setDraftId("");
    setDraftMessages([]);
    setDraftMessage("");
    setSessions((current) => [
      { id: sessionId, title: text.slice(0, 32) },
      ...current.filter((item) => item.id !== sessionId),
    ].slice(0, 12));
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

  function useSuggestion(text) {
    setMessage(text);
  }

  function usePromptPreset(text) {
    setSystemPrompt(text);
    setActivePromptPreset(text);
  }

  function formatApiError(error) {
    const detail = error?.message?.toLowerCase() || "";
    if (error?.status === 422 && (
      detail.includes("unsafe")
      || detail.includes("harmful")
      || detail.includes("override")
    )) {
      return "⚠ Safety check blocked this request. It may be harmful or try to override the assistant's safety rules.";
    }
    if (error?.status === 422) {
      return `⚠ ${error.message}`;
    }
    if (error?.status === 503) {
      return "⚠ The AI providers are temporarily unavailable. Please try again in a moment.";
    }
    if (error?.message?.includes("Failed to fetch")) {
      return "⚠ Cannot reach the assistant service. Check your connection and try again.";
    }
    return error?.message || "⚠ The assistant could not complete this request.";
  }

  async function selectSession(id) {
    if (id === sessionId || loadingSession) return;
    if (draftId === sessionId) {
      setDraftId(sessionId);
      setDraftMessages(messages);
      setDraftMessage(message);
    }
    if (id === draftId) {
      setSessionId(id);
      setMessages(draftMessages);
      setMessage(draftMessage);
      const prompts = JSON.parse(localStorage.getItem("lyfai-session-prompts") || "{}");
      setSystemPrompt(prompts[id] || "");
      setError("");
      return;
    }
    setLoadingSession(true);
    setError("");
    try {
      const history = await getSessionMessages(id);
      setSessionId(id);
      setMessages(history);
      const prompts = JSON.parse(localStorage.getItem("lyfai-session-prompts") || "{}");
      setSystemPrompt(prompts[id] || "");
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setLoadingSession(false);
    }
  }

  function createSession() {
    if (draftId === sessionId && messages.length === 0) {
      setMessage("");
      setError("");
      return;
    }
    const id = newSessionId();
    setDraftId(id);
    setDraftMessages([]);
    setDraftMessage("");
    setSessionId(id);
    setMessages([]);
    setMessage("");
    setSystemPrompt("");
    setError("");
  }

  function deleteSession(id) {
    setSessions((current) => current.filter((item) => item.id !== id));
    if (id === sessionId) {
      const id = newSessionId();
      setDraftId(id);
      setDraftMessages([]);
      setDraftMessage("");
      setSessionId(id);
      setMessages([]);
      setMessage("");
    }
  }

  return (
    <main className="app-shell">
      <SessionPanel
        draftId={draftId}
        sessionId={sessionId}
        sessions={sessions}
        loadingSession={loadingSession}
        theme={theme}
        onCreate={createSession}
        onSelect={selectSession}
        onDelete={deleteSession}
        onModal={setModal}
        onThemeChange={() => setTheme((current) => current === "dark" ? "light" : "dark")}
      />
      <section className="chat-card">
        <header>
          <div>
            <p className="eyebrow">LYFAI / PRIVATE CHAT</p>
            <h1>Think out loud<span>.</span></h1>
            <p className="subtitle">A resilient AI workspace with transparent answers.</p>
          </div>
          <div className="header-tools">
            <span className="status-dot">Online</span>
            <button
              className="profile-button"
              aria-label="Profile"
              onClick={() => setModal("profile")}
            >
              <span>LK</span>
            </button>
          </div>
        </header>
        <label className="prompt-label">
          <span className="prompt-heading">
            <span className="prompt-spark">✦</span> System prompt
            <em>optional</em>
            {systemPrompt.trim() && <em className="prompt-active">active</em>}
          </span>
          <span className="prompt-presets" aria-label="System prompt suggestions">
            <button className={activePromptPreset === "Answer as a concise technical expert." ? "active" : ""} type="button" onClick={() => usePromptPreset("Answer as a concise technical expert.")}>Concise expert</button>
            <button className={activePromptPreset === "Explain ideas clearly for a beginner." ? "active" : ""} type="button" onClick={() => usePromptPreset("Explain ideas clearly for a beginner.")}>Beginner friendly</button>
            <button className={activePromptPreset === "Review code carefully and suggest safer alternatives." ? "active" : ""} type="button" onClick={() => usePromptPreset("Review code carefully and suggest safer alternatives.")}>Code reviewer</button>
            <button className={activePromptPreset === "" && systemPrompt === "" ? "active" : ""} type="button" onClick={() => usePromptPreset("")}>Clear</button>
          </span>
          <textarea
            data-testid="system-prompt-input"
            value={systemPrompt}
            onChange={(event) => {
              setSystemPrompt(event.target.value);
              setActivePromptPreset("");
            }}
            placeholder="Shape the assistant's voice..."
            rows="2"
            maxLength="400"
          />
        </label>
        <div className="conversation">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="orb" aria-hidden="true"><span>✦</span></div>
              <p>Ask <strong>anything</strong> to start a new session.</p>
              <div className="suggestions">
                <button type="button" onClick={() => useSuggestion("Explain this concept.")}>✧ Explain this concept...</button>
                <button type="button" onClick={() => useSuggestion("Help me code.")}>‹› Help me code...</button>
                <button type="button" onClick={() => useSuggestion("Give me ideas.")}>♧ Give me ideas...</button>
              </div>
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
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(event);
              }
            }}
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
      <AppModal modal={modal} theme={theme} onClose={() => setModal(null)} />
    </main>
  );
}
