# LyfAi

LyfAi is a resilient full-stack AI chatbot built with React, FastAPI, SQLite, LiteLLM, and Docker. It supports multi-turn conversations, response caching, per-message usage metadata, and automatic API-key failover.

## Live application

- **Website:** [https://lyf-ai-git-main-krish619s-projects.vercel.app/](https://lyf-ai-git-main-krish619s-projects.vercel.app/)
- **Backend health:** [https://lyfai.onrender.com/health](https://lyfai.onrender.com/health)
- **Source code:** [https://github.com/Krish6190/LyfAI](https://github.com/Krish6190/LyfAI)

## Using the website

1. Open the live website.
2. Type a message in the chat box and select **Send**.
3. Continue sending messages to keep context within the current session.
4. Optionally enter a system prompt to customize the assistant's behavior.
5. Press **Enter** to send a message. Press **Shift+Enter** to add a new line.
6. Use the **Conversations** panel to return to sessions previously used in this browser.
7. Each assistant response displays:
   - Resolution source: `LIVE_INFERENCE` or `LLM_CACHE`
   - Model used
   - Response latency
   - Input and output tokens for that request

A new browser page starts a new session. Previous session IDs are remembered in browser local storage and can be reopened from the Conversations panel. Errors are displayed in the chat instead of leaving a blank screen.

## Run locally with Docker

### Requirements

- Docker Desktop
- Git
- An OpenAI-compatible provider API key

### Start

From the repository root:

```powershell
Copy-Item .env.example .env
```

Open `.env` and set `LLM_API_KEYS` to two comma-separated API keys. The included Groq configuration uses:

```env
LLM_MODEL=groq/openai/gpt-oss-20b
LLM_API_BASE=https://api.groq.com/openai/v1
```

Start the complete stack:

```powershell
make up
```

Open:

- Website: [http://localhost:3000](http://localhost:3000)
- API health: [http://localhost:8000/health](http://localhost:8000/health)

Stop the stack with:

```powershell
make down
```

The backend creates the SQLite database automatically. Docker stores it in the named `app_data` volume mounted at `/data`.

## Run locally without Docker

### Backend

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
uvicorn app.main:app --reload --port 8000
```

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
$env:VITE_API_URL="http://localhost:8000"
npm run dev
```

Open the Vite URL shown in the terminal, usually [http://localhost:5173](http://localhost:5173).

## API endpoints

### `GET /health`

Returns service, key-pool, cache, and database availability.

### `POST /chat`

Request:

```json
{
  "session_id": "s-demo",
  "message": "What is the capital of France?",
  "system_prompt": "Be concise."
}
```

`system_prompt` is optional. The response includes the assistant reply and request metadata.

### `GET /sessions/{session_id}/messages`

Returns the stored conversation history for a session, oldest message first.

## Caching and failover verification

Send the same first message in two different sessions. The second request should return `LLM_CACHE` with the same reply and `key_id: null`.

With `ENABLE_FAILURE_SIMULATION=true`, simulate a failed first key:

```powershell
curl.exe -X POST http://localhost:8000/chat `
  -H "Content-Type: application/json" `
  -H "X-Simulate-Failure: key_1=429" `
  -d '{\"session_id\":\"demo\",\"message\":\"Say hello\"}'
```

The response should use `key_2` and report `fallback_attempts: 1`. Using `X-Simulate-Failure: *=429` makes every key fail and returns a JSON `503` without adding the request to history.

## Deployment

The live deployment uses Vercel for the React frontend and Render for the Dockerized FastAPI backend.

- Vercel builds the `frontend` directory with `npm run build`.
- Render runs the `backend/Dockerfile`.
- `VITE_API_URL` points the frontend to the Render backend.
- `ALLOWED_ORIGINS` contains the exact Vercel website origin.
- SQLite is created automatically at `/data/app.db`.
- A Render persistent disk mounted at `/data` is needed when database data must survive service redeploys. Without one, Render's filesystem is ephemeral.

## Project structure

```text
backend/
  app/
    cache.py       # In-memory response cache
    config.py      # Environment configuration
    db.py          # SQLite schema and history storage
    main.py        # FastAPI routes and request flow
    providers.py   # LiteLLM provider failover
    schemas.py     # API request and response models
  tests/
frontend/
  src/
    components/    # Reusable chat message UI
    api.js         # Backend HTTP client
    App.jsx        # Chat session and interface
docker-compose.yml
Makefile
.env.example
```

## Security

Never commit `.env` or place real API keys in the repository. Use `.env.example` as the configuration template.

## Technology

React, Vite, FastAPI, SQLite, LiteLLM, Docker, Docker Compose, Render, Vercel, and pytest.
