import time

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .cache import CachedReply, ResponseCache
from .config import Settings
from .db import add_message, get_messages, initialize
from .providers import generate_reply
from .schemas import ChatRequest, ChatResponse, Metadata
from .safety import build_system_prompt, clean_custom_prompt, has_unsafe_request

settings = Settings.from_env()
cache = ResponseCache()
app = FastAPI(title="LyfAi Chat API")
# Allow the deployed frontend to call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    initialize(settings.database_url)


def _parse_failures(header: str | None) -> dict[str, int]:
    # Parse the optional failover demo header without exposing real key values.
    if not settings.enable_failure_simulation or not header:
        return {}
    failures: dict[str, int] = {}
    for item in header.split(","):
        key, _, status = item.strip().partition("=")
        if key and status in {"429", "500", "502", "503"}:
            failures[key] = int(status)
    return failures


def _clean_message(message: str) -> str:
    cleaned = message.strip()
    if not cleaned:
        raise HTTPException(status_code=422, detail="message cannot be empty")
    if len(cleaned) > 4000:
        raise HTTPException(status_code=422, detail="message must be 4000 characters or fewer")
    return cleaned


@app.get("/health")
def health() -> dict:
    try:
        initialize(settings.database_url)
    except Exception as error:
        raise HTTPException(status_code=503, detail="database unavailable") from error
    return {
        "status": "ok",
        "keys_configured": len(settings.api_keys),
        "cache_enabled": True,
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    x_simulate_failure: str | None = Header(default=None),
) -> ChatResponse:
    message = _clean_message(request.message)
    if has_unsafe_request(message):
        raise HTTPException(
            status_code=422,
            detail="request contains unsafe or harmful content",
        )
    try:
        custom_prompt = clean_custom_prompt(request.system_prompt)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    # Combine the system prompt, previous history, and new message for the model.
    history = get_messages(settings.database_url, request.session_id)
    system_prompt = build_system_prompt(
        settings.default_system_prompt,
        custom_prompt,
    )
    llm_messages = [{"role": "system", "content": system_prompt}]
    llm_messages.extend(
        {"role": item["role"], "content": item["content"]} for item in history
    )
    llm_messages.append({"role": "user", "content": message})
    started = time.perf_counter()
    cached = cache.get(settings.model, llm_messages)
    if cached:
        # Cache hits preserve the original reply and token counts.
        metadata = Metadata(
            resolution_source="LLM_CACHE",
            model=cached.model,
            latency_ms=max(0, int((time.perf_counter() - started) * 1000)),
            input_tokens=cached.input_tokens,
            output_tokens=cached.output_tokens,
            key_id=None,
            fallback_attempts=0,
        )
        add_message(settings.database_url, request.session_id, "user", message)
        add_message(
            settings.database_url,
            request.session_id,
            "assistant",
            cached.reply,
            metadata.model_dump(),
        )
        return ChatResponse(session_id=request.session_id, reply=cached.reply, metadata=metadata)

    try:
        # A provider failure becomes a clean 503 instead of a broken screen.
        generated = await generate_reply(
            model=settings.model,
            api_base=settings.api_base,
            api_keys=settings.api_keys,
            messages=llm_messages,
            simulated_failures=_parse_failures(x_simulate_failure),
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="all providers unavailable") from error

    cache.set(
        settings.model,
        llm_messages,
        CachedReply(
            reply=generated.reply,
            model=generated.model,
            input_tokens=generated.input_tokens,
            output_tokens=generated.output_tokens,
        ),
    )
    metadata = Metadata(
        resolution_source="LIVE_INFERENCE",
        model=generated.model,
        latency_ms=max(0, int((time.perf_counter() - started) * 1000)),
        input_tokens=generated.input_tokens,
        output_tokens=generated.output_tokens,
        key_id=generated.key_id,
        fallback_attempts=generated.fallback_attempts,
    )
    add_message(settings.database_url, request.session_id, "user", message)
    add_message(
        settings.database_url,
        request.session_id,
        "assistant",
        generated.reply,
        metadata.model_dump(),
    )
    return ChatResponse(session_id=request.session_id, reply=generated.reply, metadata=metadata)


@app.get("/sessions/{session_id}/messages")
def session_messages(session_id: str) -> dict:
    messages = get_messages(settings.database_url, session_id)
    if not messages:
        raise HTTPException(status_code=404, detail="session not found")
    return {"session_id": session_id, "messages": messages}
