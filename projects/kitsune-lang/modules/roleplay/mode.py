from modules.base import BaseModule
from modules.roleplay.language_selector import select_language, select_level, select_scenario
from modules.roleplay.conversation import run_conversation


class RoleplayModule(BaseModule):
    name = "Roleplay Mode"
    description = "Practice language through conversation roleplay"

    def run(self) -> None:
        language = select_language()
        if not language:
            return
        level = select_level(language)
        if not level:
            return
        context_path = select_scenario(language, level)
        if not context_path:
            return
        run_conversation(context_path)
