from languages.base import BaseLanguage, Level


class Japanese(BaseLanguage):
    code = "japanese"
    name = "Japanese"
    levels = [
        Level("N5", "N5 (Beginner)", "Basic survival phrases", "Simple ます/です, SOV, JLPT N5 vocabulary"),
        Level("N4", "N4", "Elementary daily conversation", "て-form, conditionals, basic compound sentences"),
        Level("N3", "N3", "Intermediate", "Passive/causative, wider vocabulary, news topics"),
        Level("N2", "N2", "Upper intermediate", "Complex grammar, abstract topics, near-newspaper level"),
        Level("N1", "N1 (Advanced)", "Near-native proficiency", "Full complexity, idiomatic expressions, literature"),
    ]
