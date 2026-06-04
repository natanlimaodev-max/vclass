from abc import ABC
from dataclasses import dataclass, field


@dataclass
class Level:
    code: str
    label: str
    description: str
    grammar_notes: str = ""


class BaseLanguage(ABC):
    code: str = ""
    name: str = ""
    levels: list[Level] = field(default_factory=list)

    def get_level(self, code: str) -> Level | None:
        return next((l for l in self.levels if l.code == code), None)

    def level_codes(self) -> list[str]:
        return [l.code for l in self.levels]
