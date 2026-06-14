import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
import config
from modules import MODULES

console = Console()


def main():
    try:
        config.validate()
    except EnvironmentError as e:
        console.print(f"[red]Config error: {e}[/red]")
        console.print("Copy .env.example to .env and fill in your API keys.")
        sys.exit(1)

    while True:
        console.clear()
        console.print(Panel(Text("KITSUNE AGENT", justify="center", style="bold cyan"), border_style="cyan"))
        console.print()
        for i, module in enumerate(MODULES, 1):
            console.print(f"  [bold]{i}.[/bold] {module.name}")
        console.print(f"  [bold]{len(MODULES) + 1}.[/bold] Exit")
        console.print()

        choice = console.input("[bold]Select:[/bold] ").strip()

        try:
            idx = int(choice) - 1
        except ValueError:
            continue

        if idx == len(MODULES):
            break
        if 0 <= idx < len(MODULES):
            MODULES[idx].run()


if __name__ == "__main__":
    main()
