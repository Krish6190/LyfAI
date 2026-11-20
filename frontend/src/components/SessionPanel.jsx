export function SessionPanel({
  draftId,
  sessionId,
  sessions,
  loadingSession,
  theme,
  onCreate,
  onSelect,
  onDelete,
  onModal,
  onThemeChange,
}) {
  return (
    <aside className="session-panel">
      <div className="brand">
        <span className="brand-mark">✦</span>
        <div><strong>LYFAI</strong><small>Think · Create · Explore</small></div>
      </div>
      <p className="session-heading">◷ Sessions</p>
      <button className="new-session-button" onClick={onCreate}>
        <span>＋</span> New conversation
      </button>
      <div className="session-list">
        {draftId && (
          <div className={`session-row ${draftId === sessionId ? "selected" : ""}`}>
            <button
              className="session-item"
              onClick={() => onSelect(draftId)}
              disabled={loadingSession || draftId === sessionId}
            >
              <span className="session-icon">▱</span>
              <span><strong>New conversation</strong><small>◷ {draftId}</small></span>
            </button>
          </div>
        )}
        {sessions.map((item) => (
          <div className={`session-row ${item.id === sessionId ? "selected" : ""}`} key={item.id}>
            <button className="session-item" onClick={() => onSelect(item.id)} disabled={loadingSession}>
              <span className="session-icon">▱</span>
              <span><strong>{item.title}</strong><small>◷ {item.id}</small></span>
            </button>
            <button
              className="delete-session"
              onClick={() => onDelete(item.id)}
              aria-label={`Delete session ${item.id}`}
              title="Remove session"
            >×</button>
          </div>
        ))}
      </div>
      <div className="session-tools">
        <button title="Settings" aria-label="Settings" onClick={() => onModal("settings")}>⚙</button>
        <button
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-label="Toggle theme"
          onClick={onThemeChange}
        >{theme === "dark" ? "◐" : "☀"}</button>
      </div>
      <p className="session-note">⚡ Your sessions are remembered in this browser.</p>
    </aside>
  );
}
