from fastapi.testclient import TestClient

from app import main
from app.providers import ProviderReply


def _client(tmp_path, monkeypatch):
    main.settings = main.Settings(
        database_url=str(tmp_path / "test.db"),
        allowed_origins=["http://localhost:3000"],
        api_keys=["first", "second"],
        model="test/model",
        api_base=None,
        default_system_prompt="Test assistant",
        enable_failure_simulation=True,
    )
    main.cache = main.ResponseCache()
    main.initialize(main.settings.database_url)
    return TestClient(main.app), monkeypatch


def test_chat_cache_and_history(tmp_path, monkeypatch):
    client, _ = _client(tmp_path, monkeypatch)

    async def fake_generate_reply(**kwargs):
        return ProviderReply("Paris", "test/model", 10, 1, "key_1", 0)

    monkeypatch.setattr(main, "generate_reply", fake_generate_reply)
    first = client.post("/chat", json={"session_id": "s1", "message": "Capital?"})
    second = client.post("/chat", json={"session_id": "s2", "message": "Capital?"})

    assert first.status_code == 200
    assert first.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"
    assert second.json()["metadata"]["resolution_source"] == "LLM_CACHE"
    assert second.json()["metadata"]["key_id"] is None


def test_validation_and_simulated_failure(tmp_path, monkeypatch):
    client, _ = _client(tmp_path, monkeypatch)

    async def fake_generate_reply(**kwargs):
        assert kwargs["simulated_failures"] == {"key_1": 429}
        return ProviderReply("Fallback", "test/model", 3, 1, "key_2", 1)

    monkeypatch.setattr(main, "generate_reply", fake_generate_reply)
    response = client.post(
        "/chat",
        headers={"X-Simulate-Failure": "key_1=429"},
        json={"session_id": "s1", "message": "Hello"},
    )
    assert response.status_code == 200
    assert response.json()["metadata"]["key_id"] == "key_2"
    assert client.post("/chat", json={"session_id": "s1", "message": " "}).status_code == 422
