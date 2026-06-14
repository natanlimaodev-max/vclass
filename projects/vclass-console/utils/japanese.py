import re

FURIGANA_INSTRUCTION = """
## Furigana Format — MANDATORY

**RULE: Furigana brackets [] appear ONLY after words that contain kanji (CJK characters). NEVER after pure hiragana or pure katakana.**

Test before adding []: Does the word contain at least one kanji character (not kana)? YES → add furigana. NO → do NOT add brackets, ever.

Format: kanji-word [hiragana-reading]
- Space before bracket
- Reading covers the kanji part of the word (okurigana stays outside)
- One bracket per kanji unit

CORRECT:
  今日 [きょう] はいい天気 [てんき] ですね。
  お名前 [なまえ] は何 [なん] ですか？
  申し訳 [もうしわけ] ありませんが、内容 [ないよう] にはお答 [こた] えできません。
  アルバイトの経験 [けいけん] はありますか？  ← アルバイト has NO brackets; 経験 has brackets
  教 [おし] えてください。  ← 教 is kanji → must have brackets; えてください is hiragana → NO brackets
  どのような仕事 [しごと] をしていましたか？
  私 [わたし] は田中 [たなか] といいます。  ← 私 and 田中 both need brackets
  東京 [とうきょう] から来 [き] ました。  ← 来 needs brackets even with okurigana after it

WRONG — furigana on kana-only words (FORBIDDEN):
  ありがとう [ありがとう]  ← FORBIDDEN: pure hiragana
  アルバイト [あるばいと]  ← FORBIDDEN: pure katakana
  ください [ください]      ← FORBIDDEN: pure hiragana
  テレビ [てれび]          ← FORBIDDEN: pure katakana
  どのような [どのような]  ← FORBIDDEN: pure hiragana

WRONG — missing furigana on kanji (FORBIDDEN):
  申し訳ありませんが、内容にはお答えできません。← FORBIDDEN: missing readings
  教えてください。← FORBIDDEN: 教 is kanji, must be 教 [おし] えてください。
  どのような仕事をしていましたか？← FORBIDDEN: 仕事 is kanji, must be 仕事 [しごと]
  私は田中 [たなか] といいます。← FORBIDDEN: 私 has no bracket
  東京 [とうきょう] から来ました。← FORBIDDEN: 来 has no bracket

Every kanji character (一-龯) in your response MUST be followed within a few characters by [reading]. No exceptions.
"""

JAPANESE_EXPLAIN_PROMPT = """Você é um professor de japonês. O aluno acabou de ouvir a seguinte frase em uma conversa em japonês. Explique-a detalhadamente em português.

Frase: {sentence}

Estruture sua explicação assim:

**1. Tradução**
Tradução natural e completa.

**2. Vocabulário**
Liste cada palavra/expressão importante com leitura (furigana nos kanjis) e significado.

**3. Gramática**
Explique os pontos gramaticais usados (estruturas, conjugações, partículas).

**4. Nível de formalidade**
Indique o nível de polidez (casual / 丁寧語 / 敬語) e por quê.

**5. Observações extras**
Nuances culturais, formas alternativas de dizer ou dicas relevantes (se houver).

Seja preciso e didático."""


def strip_furigana(text: str) -> str:
    """Remove [reading] annotations for TTS — speak only the kanji/kana."""
    return re.sub(r'\s*\[[^\]]+\]', '', text)


# CJK Unified Ideographs U+4E00-U+9FFF + Extension A U+3400-U+4DBF
_KANJI_RE = re.compile(u'[一-鿿㐀-䶿]')

# Matches annotated kanji words: kanji+ optional-okurigana(hiragana) [reading]
# Handles: 田中 [たなか], 来 [き]ました (bracket right after kanji), 教 [おし]えて
_ANNOTATED_RE = re.compile(
    u'[一-鿿㐀-䶿]+'   # one or more kanji
    u'[぀-ゟ]*'                 # optional hiragana okurigana
    u'\\s*\\[[^\\]]+\\]'               # [reading]
)


def has_missing_furigana(text: str) -> bool:
    """True if any kanji remains after removing all properly annotated words."""
    cleaned = _ANNOTATED_RE.sub('', text)
    return bool(_KANJI_RE.search(cleaned))
