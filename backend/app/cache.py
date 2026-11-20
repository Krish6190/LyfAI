import hashlib
import json
from dataclasses import dataclass


@dataclass(frozen=True)
class CachedReply:
    reply: str
    model: str
    input_tokens: int
    output_tokens: int


class ResponseCache:
    def __init__(self) -> None:
        # Keep cache entries in memory so repeated prompts return quickly.
        self._items: dict[str, CachedReply] = {}

    @staticmethod
    def key(model: str, messages: list[dict[str, str]]) -> str:
        # Include the complete prompt and model so different prompts never collide.
        value = json.dumps(
            {"model": model, "messages": messages},
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def get(self, model: str, messages: list[dict[str, str]]) -> CachedReply | None:
        return self._items.get(self.key(model, messages))

    def set(
        self,
        model: str,
        messages: list[dict[str, str]],
        reply: CachedReply,
    ) -> None:
        self._items[self.key(model, messages)] = reply
