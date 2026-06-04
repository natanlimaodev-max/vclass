from pathlib import Path
from rich.console import Console
from rich.panel import Panel
import yaml
from services import llm, tts
from modules.roleplay.actions import get_action, Action
from utils.japanese import FURIGANA_INSTRUCTION, JAPANESE_EXPLAIN_PROMPT, strip_furigana, has_missing_furigana

console = Console()


def parse_context(path: Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    if raw.startswith("---"):
        parts = raw.split("---", 2)
        frontmatter = yaml.safe_load(parts[1])
        body = parts[2].strip()
    else:
        frontmatter = {}
        body = raw.strip()
    return frontmatter, body


def run_conversation(context_path: Path) -> None:
    import config

    frontmatter, body = parse_context(context_path)
    voice_id = frontmatter.get("voice_id") or config.ELEVENLABS_VOICE_ID
    lang = frontmatter.get("language", "")
    is_japanese = lang == "japanese"
    stt_language_code = {"japanese": "ja", "english": "en"}.get(lang)

    system_content = body + FURIGANA_INSTRUCTION if is_japanese else body
    history: list[dict] = [{"role": "system", "content": system_content}]

    console.clear()
    scenario_name = context_path.stem.replace("_", " ").title()
    console.print(Panel(f"[bold cyan]{scenario_name}[/bold cyan]", border_style="cyan"))
    console.print()

    with console.status("[dim]Thinking...[/dim]"):
        assistant_msg = llm.chat(history)
        if is_japanese and has_missing_furigana(assistant_msg):
            assistant_msg = _fix_furigana(assistant_msg)

    history.append({"role": "assistant", "content": assistant_msg})
    _display_assistant(assistant_msg)

    _speak(assistant_msg, voice_id)

    while True:
        action, user_text = get_action(stt_language_code)

        if action == Action.EXIT:
            break

        if action == Action.TRY_AGAIN:
            if len(history) > 1 and history[-1]["role"] == "assistant":
                history.pop()
            if len(history) > 1 and history[-1]["role"] == "user":
                history.pop()
            last_assistant = next((m for m in reversed(history) if m["role"] == "assistant"), None)
            if last_assistant:
                _display_assistant(last_assistant["content"])
                _speak(last_assistant["content"], voice_id)
            continue

        if action == Action.EXPLAIN:
            last_assistant = next((m for m in reversed(history) if m["role"] == "assistant"), None)
            if last_assistant:
                _explain_sentence(last_assistant["content"], is_japanese, lang)
            continue

        if not user_text:
            continue

        _display_user(user_text)
        history.append({"role": "user", "content": user_text})

        with console.status("[dim]Thinking...[/dim]"):
            assistant_msg = llm.chat(history)
            if is_japanese and has_missing_furigana(assistant_msg):
                assistant_msg = _fix_furigana(assistant_msg)

        history.append({"role": "assistant", "content": assistant_msg})
        _display_assistant(assistant_msg)
        _speak(assistant_msg, voice_id)


def _fix_furigana(text: str, max_attempts: int = 2) -> str:
    for _ in range(max_attempts):
        if not has_missing_furigana(text):
            break
        prompt = (
            "The following Japanese text is missing furigana on some kanji. "
            "Add furigana using format: kanji [reading]. "
            "Rules: brackets ONLY after kanji-containing words, NEVER after pure hiragana or katakana. "
            "Every single kanji character MUST have [reading] after it. "
            "Return ONLY the corrected Japanese text, nothing else.\n\n"
            f"{text}"
        )
        text = llm.chat([{"role": "user", "content": prompt}])
    return text


def _speak(text: str, voice_id: str) -> None:
    try:
        with console.status("[dim]Speaking...[/dim]"):
            tts.speak(strip_furigana(text), voice_id)
    except Exception as e:
        console.print(f"[bold red]TTS error: {e}[/bold red]")


def _display_assistant(text: str) -> None:
    console.print(Panel(text, title="[bold green]Agent[/bold green]", border_style="green"))


def _display_user(text: str) -> None:
    console.print(Panel(text, title="[bold blue]You[/bold blue]", border_style="blue"))


def _explain_sentence(sentence: str, is_japanese: bool, lang: str = "") -> None:
    clean = strip_furigana(sentence)
    if is_japanese:
        prompt = JAPANESE_EXPLAIN_PROMPT.format(sentence=clean)
    else:
        prompt = f"Explain this sentence in detail in Portuguese, covering vocabulary, grammar, and any relevant cultural notes:\n\n{clean}"

    with console.status("[dim]Explaining...[/dim]"):
        explanation = llm.chat([{"role": "user", "content": prompt}])

    console.print(Panel(explanation, title="[bold yellow]Explanation[/bold yellow]", border_style="yellow"))

    if is_japanese:
        examples_prompt = (
            f"A seguinte frase foi dita em uma conversa em japonês:\n\n{clean}\n\n"
            "Dê 3 exemplos naturais de como responder a essa frase em japonês. "
            "Para cada exemplo: mostre a frase em japonês (com furigana), romaji e tradução em português. "
            "Formate como lista numerada."
        )
    else:
        examples_prompt = (
            f"The following sentence was said in an English conversation:\n\n{clean}\n\n"
            "Give 3 natural example responses in English. "
            "For each: show the response and its Portuguese translation. "
            "Format as a numbered list."
        )

    with console.status("[dim]Generating response examples...[/dim]"):
        examples = llm.chat([{"role": "user", "content": examples_prompt}])

    console.print(Panel(examples, title="[bold magenta]How to respond[/bold magenta]", border_style="magenta"))
