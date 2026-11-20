from dataclasses import dataclass

@dataclass(frozen=True)
class ProviderReply:
    reply: str
    model: str
    input_tokens: int
    output_tokens: int
    key_id: str
    fallback_attempts: int


def _usage_value(usage: object, name: str) -> int:
    value = getattr(usage, name, None)
    return int(value or 0)


async def generate_reply(
    *,
    model: str,
    api_base: str | None,
    api_keys: list[str],
    messages: list[dict[str, str]],
    simulated_failures: dict[str, int],
) -> ProviderReply:
    # Import LiteLLM only when inference is requested so tests can mock the gateway.
    from litellm import acompletion

    last_error: Exception | None = None
    for index, api_key in enumerate(api_keys):
        key_id = f"key_{index + 1}"
        # Skip keys selected by the demo failure header for this request only.
        if key_id in simulated_failures or "*" in simulated_failures:
            last_error = RuntimeError(f"simulated provider failure for {key_id}")
            continue
        try:
            # Try keys in order and move to the next one after provider failures.
            response = await acompletion(
                model=model,
                messages=messages,
                api_key=api_key,
                api_base=api_base,
            )
            choice = response.choices[0]
            text = choice.message.content
            if not text:
                raise RuntimeError("provider returned an empty response")
            return ProviderReply(
                reply=text,
                model=model,
                input_tokens=_usage_value(response.usage, "prompt_tokens"),
                output_tokens=_usage_value(response.usage, "completion_tokens"),
                key_id=key_id,
                fallback_attempts=index,
            )
        except Exception as error:
            last_error = error
    raise RuntimeError("all providers unavailable") from last_error
