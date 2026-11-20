# LyfAi

LyfAi is a full-stack AI chatbot built with React, FastAPI, SQLite, LiteLLM, and Docker. It supports multi-turn conversations, API-key failover, response caching, and per-message usage metadata.

## 1. Live URLs

- **Website:** [https://lyf-ai-git-main-krish619s-projects.vercel.app/](https://lyf-ai-git-main-krish619s-projects.vercel.app/)
- **Backend API:** [https://lyfai.onrender.com/](https://lyfai.onrender.com/)
- **Health endpoint:** [https://lyfai.onrender.com/health](https://lyfai.onrender.com/health)
- **Source code:** [https://github.com/Krish6190/LyfAI](https://github.com/Krish6190/LyfAI)

### Using the website

1. Open the live website.
2. Type a message and press **Enter** to send it.
3. Press **Shift+Enter** to add a new line.
4. Continue chatting to keep conversation context.
5. Open **Conversations** to switch between sessions used in that browser.
6. Optionally enter a system prompt to customize the assistant.
7. Use the `×` beside a saved conversation to remove it from the browser list.

Each assistant reply shows its resolution source, model, latency, input tokens, and output tokens.

## 2. Run locally: with Docker and without

### With Docker

Requirements: Docker Desktop, Git, and two OpenAI-compatible API keys.

```powershell
cd C:\Users\krish\OneDrive\Desktop\LyfAi
Copy-Item .env.example .env
```

Put the API keys in `LLM_API_KEYS` and configure the model in `.env`. The included Groq setup uses:

```env
LLM_MODEL=groq/openai/gpt-oss-20b
LLM_API_BASE=https://api.groq.com/openai/v1
```

Start the stack:

```powershell
docker compose up --build -d
```

Open [http://localhost:3000](http://localhost:3000). The API health endpoint is [http://localhost:8000/health](http://localhost:8000/health).

Stop the stack:

```powershell
docker compose down
```

Docker creates an `app_data` named volume mounted at `/data`. SQLite is created automatically at `/data/app.db`.

### Without Docker

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
$env:DATABASE_URL="sqlite:///./app.db"
$env:LLM_API_KEYS="your-key-1,your-key-2"
$env:LLM_MODEL="groq/openai/gpt-oss-20b"
$env:LLM_API_BASE="https://api.groq.com/openai/v1"
$env:ALLOWED_ORIGINS="http://localhost:3000"
$env:ENABLE_FAILURE_SIMULATION="true"
uvicorn app.main:app --reload --port 8000
```

Frontend in a second terminal:

```powershell
cd frontend
npm install
$env:VITE_API_URL="http://localhost:8000"
npm run dev
```

## 3. Design decisions: key fallback, caching, SQLite session storage

### API-key fallback

LiteLLM sends requests through the configured OpenAI-compatible provider. The backend tries `key_1`, `key_2`, and subsequent configured keys in order. Simulated failures are isolated to one request and never expose real key values.

### Caching

Responses are cached in memory using a hash of the model and complete message list, including the system prompt, history, and new message. A cache hit returns the identical reply and stored token counts with `LLM_CACHE`. A live response uses `LIVE_INFERENCE`.

### SQLite storage

SQLite stores each session's user and assistant messages. New sessions start separately, but each session retains multi-turn history. The Docker volume preserves the SQLite file across container restarts.

### API contract

The backend exposes:

- `GET /health`
- `POST /chat`
- `GET /sessions/{session_id}/messages`

### Backend environment variables

| Variable | Meaning |
|---|---|
| `LLM_API_KEYS` | Comma-separated key pool, with at least two keys. Key IDs are assigned in order as `key_1`, `key_2`, and so on. |
| `DATABASE_URL` | SQLite location. Docker uses `sqlite:////data/app.db`. |
| `ALLOWED_ORIGINS` | Comma-separated browser origins permitted by CORS. |
| `ENABLE_FAILURE_SIMULATION` | Set to `true` to enable the `X-Simulate-Failure` failover test header. |
| `LLM_MODEL` | LiteLLM model name, such as `groq/openai/gpt-oss-20b`. |
| `LLM_API_BASE` | OpenAI-compatible provider base URL, such as `https://api.groq.com/openai/v1`. |
| `DEFAULT_SYSTEM_PROMPT` | Optional fallback system prompt used when a request does not provide one. |

A chat request is JSON:

```json
{
  "session_id": "s-demo",
  "message": "What is the capital of France?",
  "system_prompt": "Be concise."
}
```

Invalid requests return JSON `422`; unavailable providers return JSON `503`; unknown sessions return JSON `404`.

## 4. Verification: how to see failover, cache hits and per-message token usage

### Live health

Open [https://lyfai.onrender.com/health](https://lyfai.onrender.com/health). It should report the running status, number of configured keys, and cache status.

### Cache hit

1. Send a distinctive first message in one browser session.
2. Open the live website in a new tab.
3. Send the exact same message.
4. The second response should show `LLM_CACHE`, identical reply text, and a `null` key ID.

The cache key includes the complete message list sent to the model. Repeating the same text inside an existing session does not usually reuse the cache because the session history now adds earlier messages. Repeat the first message in a second, separate session to demonstrate the assignment's cache-hit behavior.

### Failover

Run this from a separate PowerShell window:

```powershell
curl.exe -X POST https://lyfai.onrender.com/chat `
  -H "Content-Type: application/json" `
  -H "X-Simulate-Failure: key_1=429" `
  -d '{\"session_id\":\"video-failover-12345\",\"message\":\"Say fallback is working\"}'
```

This is an API test, not a chat-box message. The header makes `key_1` behave as if it returned 429 for that request, and the response should use `key_2` with `fallback_attempts: 1`.

Supported simulation header formats:

| Header | Result |
|---|---|
| `X-Simulate-Failure: key_1=429` | `key_1` fails with 429; `key_2` should answer successfully. |
| `X-Simulate-Failure: key_1=500` | `key_1` fails with 500; `key_2` should answer successfully. |
| `X-Simulate-Failure: key_1=429,key_2=500` | Both listed keys fail for this request. |
| `X-Simulate-Failure: *=429` | Every configured key fails with 429 and the API returns `503`. |

Use `X-Simulate-Failure: *=429` to demonstrate all-provider failure. It should return `503 {"detail":"all providers unavailable"}` without adding the failed request to history.

### Per-message usage

Every assistant message displays input and output token counts for that individual request. Cache hits preserve the original stored usage.

### Tests

Run the backend tests:

```powershell
cd backend
python -m pytest -q
```

Build the frontend:

```powershell
cd frontend
npm run build
```

## 5. Setup Used: your editor and AI tools

- Editor: VS Code
- Frontend: React, Vite, CSS, JavaScript
- Backend: Python, FastAPI, Pydantic
- Model gateway: LiteLLM
- Provider: Groq with an OpenAI-compatible API
- Storage: SQLite
- Deployment: Docker, Docker Compose, Render, and Vercel
- Testing: pytest
- Source control: Git and GitHub

## 6. Bonus features (if any): what you added beyond the requirements and why

- Optional system-prompt input for controlling the session voice.
- Conversation switching with browser-stored session IDs and history loaded through SQLite.
- Enter-to-send and Shift+Enter newline behavior.
- Responsive dark interface with request metadata beside every assistant reply.
- Readable JSON errors and API status handling instead of blank UI states.
- Docker startup with a persistent named SQLite volume.

Authentication was intentionally not included within the short assignment time limit. The public demo uses client-generated session IDs, so chat history should not be considered private. A production release would add user authentication, authorization, session ownership, rate limiting, and stronger secret management.
