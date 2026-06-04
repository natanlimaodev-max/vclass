from enum import Enum
from rich.console import Console

console = Console()


class Action(Enum):
    SPEAK = "speak"
    CONTINUE = "continue"
    TRY_AGAIN = "try_again"
    EXIT = "exit"
    EXPLAIN = "explain"


def get_action(language_code: str | None = None) -> tuple[Action, str | None]:
    console.print()
    console.print("[dim]  1. Speak   2. Type   3. Try Again   4. Exit   5. Explain sentence[/dim]")
    choice = console.input("  Action: ").strip()

    if choice == "1":
        return Action.SPEAK, _do_speak(language_code)
    elif choice == "2":
        text = console.input("  You: ").strip()
        return Action.CONTINUE, text if text else None
    elif choice == "3":
        return Action.TRY_AGAIN, None
    elif choice == "4":
        return Action.EXIT, None
    elif choice == "5":
        return Action.EXPLAIN, None
    else:
        return get_action(language_code)


def _do_speak(language_code: str | None = None) -> str | None:
    try:
        from services import stt
        console.print("  [dim]Recording... (5s)[/dim]")
        text = stt.listen(language_code=language_code)
        if not text:
            return None
        return _confirm_speak(text, language_code)
    except Exception as e:
        console.print(f"  [red]STT error: {e}[/red]")
        return None


def _confirm_speak(text: str, language_code: str | None = None) -> str | None:
    from rich.panel import Panel
    console.print()
    console.print(Panel(text, title="[bold blue]Captured[/bold blue]", border_style="blue"))
    console.print("[dim]  1. Send   2. Continue sentence   3. Redo   4. Cancel[/dim]")
    choice = console.input("  Action: ").strip()

    if choice == "1":
        return text
    elif choice == "2":
        extra = console.input("  Continue: ").strip()
        combined = f"{text} {extra}".strip() if extra else text
        return _confirm_speak(combined, language_code)
    elif choice == "3":
        return _do_speak(language_code)
    elif choice == "4":
        return None
    else:
        return _confirm_speak(text, language_code)
