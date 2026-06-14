from pathlib import Path
from rich.console import Console
from languages import LANGUAGES
from languages.base import BaseLanguage, Level

console = Console()
CONTEXTS_DIR = Path(__file__).parent.parent.parent / "contexts"


def select_language() -> BaseLanguage | None:
    langs = list(LANGUAGES.values())
    console.print("\n[bold]Select language:[/bold]")
    for i, lang in enumerate(langs, 1):
        console.print(f"  {i}. {lang.name}")
    console.print(f"  {len(langs) + 1}. Back")

    choice = console.input("\nSelect: ").strip()
    try:
        idx = int(choice) - 1
    except ValueError:
        return None
    if idx == len(langs):
        return None
    if 0 <= idx < len(langs):
        return langs[idx]
    return None


def select_level(language: BaseLanguage) -> Level | None:
    console.print(f"\n[bold]Select level ({language.name}):[/bold]")
    for i, level in enumerate(language.levels, 1):
        console.print(f"  {i}. {level.label}")
    console.print(f"  {len(language.levels) + 1}. Back")

    choice = console.input("\nSelect: ").strip()
    try:
        idx = int(choice) - 1
    except ValueError:
        return None
    if idx == len(language.levels):
        return None
    if 0 <= idx < len(language.levels):
        return language.levels[idx]
    return None


def select_scenario(language: BaseLanguage, level: Level) -> Path | None:
    scenario_dir = CONTEXTS_DIR / language.code / level.code
    if not scenario_dir.exists():
        console.print(f"[red]No scenarios for {language.name} {level.code}[/red]")
        console.input("Press Enter to continue...")
        return None

    scenarios = sorted(scenario_dir.glob("*.md"))
    if not scenarios:
        console.print(f"[red]No scenario files in {scenario_dir}[/red]")
        console.input("Press Enter to continue...")
        return None

    console.print("\n[bold]Select scenario:[/bold]")
    for i, s in enumerate(scenarios, 1):
        name = s.stem.replace("_", " ").title()
        console.print(f"  {i}. {name}")
    console.print(f"  {len(scenarios) + 1}. Back")

    choice = console.input("\nSelect: ").strip()
    try:
        idx = int(choice) - 1
    except ValueError:
        return None
    if idx == len(scenarios):
        return None
    if 0 <= idx < len(scenarios):
        return scenarios[idx]
    return None
