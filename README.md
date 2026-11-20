# LyfAi

## 1. Live URLs

After deployment, set these values:

- Frontend: `https://your-project.vercel.app`
- Backend: `https://your-service.onrender.com`

Replace the placeholders above with your actual URLs.

## 2. Run locally: with Docker and without

### With Docker

1. Copy `.env.example` to `.env`.
2. Put two real API keys in `LLM_API_KEYS`.
3. Run `make up`.
4. Open [http://localhost:3000](http://localhost:3000). The API is at [http://localhost:8000](http://localhost:8000).
5. Stop with `make down`.

### Without Docker

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```powershell
cd frontend
npm install
$env:VITE_API_URL="http://localhost:8000"
npm run dev
```

For a non-Docker backend, use `DATABASE_URL=sqlite:///./app.db` and set the other values from `.env.example`.

## Deploying with Render + Vercel

### 1. Deploy the backend on Render

1. Push this folder to a public GitHub repository.
2. In Render, choose **New + > Web Service**, connect the repository, and select **Docker**.
3. Set the Docker context/root directory to `backend`.
4. You do **not** create a separate database: the application creates `/data/app.db` and its tables automatically on startup.
5. Attach a persistent disk mounted at `/data` if SQLite data must survive redeploys. Render's default filesystem is ephemeral, and persistent disks require a paid Render service.
6. Add these environment variables:

   - `LLM_API_KEYS`: two comma-separated provider keys
   - `LLM_MODEL`: for example `groq/openai/gpt-oss-20b`
   - `LLM_API_BASE`: for example `https://api.groq.com/openai/v1`
   - `DATABASE_URL`: `sqlite:////data/app.db`
   - `ALLOWED_ORIGINS`: temporarily use `https://your-project.vercel.app`, then update it after Vercel deploys
   - `ENABLE_FAILURE_SIMULATION`: `true`
   - `DEFAULT_SYSTEM_PROMPT`: `You are a helpful, concise assistant.`
7. Deploy and open `https://your-service.onrender.com/health`. It should return `"status":"ok"`.

### 2. Deploy the frontend on Vercel

1. In Vercel, import the same GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Vercel detects Vite automatically. Use `npm run build` as the build command and `dist` as the output directory.
4. Add `VITE_API_URL=https://your-service.onrender.com`.
5. Deploy and open the generated Vercel URL.
6. Go back to Render and set `ALLOWED_ORIGINS` to the exact Vercel URL, then redeploy the backend.

The browser frontend must use the Render URL, not `localhost`. Test the connection by sending a message and opening the backend `/health` endpoint.

### Showing the Docker requirement

Docker is explicitly mandatory in the assignment. In your demo, show:

1. `make up` starting both services.
2. `docker compose ps` showing `backend` and `frontend` as running.
3. `http://localhost:3000` displaying the chat.
4. `http://localhost:8000/health` returning the health JSON.
5. `make down` stopping the stack.

For the live submission, Render runs the backend Dockerfile and Vercel builds the frontend Docker-independent. The repository still includes the required Dockerfiles, `docker-compose.yml`, named `/data` volume, and Makefile.

## 3. Design decisions: key fallback, caching, SQLite session storage

- `providers.py` tries keys in order and records only `key_1`, `key_2`, etc.; the key material never enters a response.
- LiteLLM provides the OpenAI-compatible model gateway. The small in-memory cache is keyed by model plus the complete system/history/new-message list, preserving exact cache-hit replies and token usage.
- SQLite stores user and assistant messages under the configured `DATABASE_URL`. Docker mounts `/data` as a named volume so history survives restarts.
- Every failed provider attempt is isolated. If all keys fail, the API returns JSON `503` without writing the request to history.

Free providers you can use:

- **Groq**: free developer tier; use `LLM_MODEL=groq/openai/gpt-oss-20b`, `LLM_API_BASE=https://api.groq.com/openai/v1`. Model availability can change, so check the provider's models endpoint if a model is retired.
- **OpenRouter**: offers free model routes; use a model such as `openrouter/google/gemini-2.0-flash-exp:free`, `LLM_API_BASE=https://openrouter.ai/api/v1`.
- **Google Gemini**: use LiteLLM's Gemini model names and a Gemini key; see LiteLLM's provider docs for the current model name.

Use two keys from one provider or a mix of compatible providers. Never commit `.env`.

## 4. Verification: how to see failover, cache hits and per-message token usage

The app starts a new session on each page load. Send the same first message twice in separate sessions: the second response should show `LLM_CACHE`, identical text, and `key_id` as `null`. Metadata beside each answer shows source, model, latency, input tokens, and output tokens for that request only.

With `ENABLE_FAILURE_SIMULATION=true`, demonstrate fallback:

```powershell
curl -X POST http://localhost:8000/chat `
  -H "Content-Type: application/json" `
  -H "X-Simulate-Failure: key_1=429" `
  -d '{\"session_id\":\"demo\",\"message\":\"Say hello\"}'
```

This should use `key_2`. `X-Simulate-Failure: *=429` should return `503` and should not add a message. The backend tests cover cache, validation, and simulated fallback.

## 5. Setup Used

VS Code with Copilot SDK, React/Vite, FastAPI, SQLite, LiteLLM, Docker Compose, and pytest.

## 6. Bonus features (if any)

- Optional per-session system prompt field.
- Responsive dark interface with readable provider metadata.
- A provider base URL makes the same backend compatible with several OpenAI-compatible free API services.
