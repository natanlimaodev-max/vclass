from openai import OpenAI
import config

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=config.OPENROUTER_API_KEY,
        )
    return _client


def chat(history: list[dict], model: str | None = None) -> str:
    response = _get_client().chat.completions.create(
        model=model or config.OPENROUTER_MODEL,
        messages=history,
    )
    if hasattr(response, "error") and response.error:
        raise RuntimeError(f"LLM error: {response.error}")
    if not response.choices:
        raise RuntimeError(f"LLM returned no choices. Full response: {response}")
    content = response.choices[0].message.content
    if content is None:
        raise RuntimeError(f"LLM returned null content. Choice: {response.choices[0]}")
    return content
