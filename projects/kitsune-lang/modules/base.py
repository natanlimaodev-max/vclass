from abc import ABC, abstractmethod


class BaseModule(ABC):
    name: str = ""
    description: str = ""

    @abstractmethod
    def run(self) -> None: ...
