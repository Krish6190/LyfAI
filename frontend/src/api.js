const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function sendMessage(payload) {
  // Keep the frontend independent from the local or deployed API hostname.
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The assistant returned an unreadable response. Please try again.");
  }
  if (!response.ok) {
    const detail = typeof data.detail === "string"
      ? data.detail
      : "The assistant could not complete this request.";
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function getSessionMessages(sessionId) {
  const response = await fetch(`${API_URL}/sessions/${sessionId}/messages`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to load this session.");
  return data.messages;
}
