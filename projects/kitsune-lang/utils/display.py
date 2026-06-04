from rich.console import Console
from rich.panel import Panel

console = Console()


def print_assistant(text: str) -> None:
    console.print(Panel(text, title="[bold green]Agent[/bold green]", border_style="green"))


def print_user(text: str) -> None:
    console.print(Panel(text, title="[bold blue]You[/bold blue]", border_style="blue"))


def print_error(text: str) -> None:
    console.print(f"[red]{text}[/red]")
