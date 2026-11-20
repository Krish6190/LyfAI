export function AppModal({ modal, theme, onClose }) {
  if (!modal) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dummy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        {modal === "settings" ? (
          <>
            <p className="modal-eyebrow">LYFAI / PREFERENCES</p>
            <h2 id="modal-title">Settings</h2>
            <div className="dummy-setting"><span>Appearance</span><strong>{theme === "dark" ? "Midnight" : "Light"}</strong></div>
            <div className="dummy-setting"><span>Notifications</span><strong>Demo mode</strong></div>
          </>
        ) : (
          <>
            <p className="modal-eyebrow">LYFAI / PROFILE</p>
            <div className="modal-avatar">LK</div>
            <h2 id="modal-title">Guest workspace</h2>
            <p className="modal-copy">This demo session is stored locally in your browser.</p>
          </>
        )}
        <button className="modal-action" onClick={onClose}>Done</button>
      </section>
    </div>
  );
}
