import React from "react";

// Matches kanji+ optional-okurigana [reading] — same logic as kitsune-lang _ANNOTATED_RE
// Kanji: U+4E00-U+9FFF (CJK Unified) + U+3400-U+4DBF (Extension A)
// Okurigana: U+3041-U+3096 (hiragana)
const FURIGANA_RE = /([一-鿿㐀-䶿]+[ぁ-ゖ]*)\s*\[([^\]]+)\]/g;

export function renderFurigana(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  FURIGANA_RE.lastIndex = 0;
  while ((match = FURIGANA_RE.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    nodes.push(
      <ruby key={match.index}>
        {match[1]}
        <rt>{match[2]}</rt>
      </ruby>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}
