import React from "react";

// Matches: word [reading] — e.g. "田中 [たなか]" or "来 [き]"
const FURIGANA_RE = /([^\s\[]+)\s*\[([^\]]+)\]/g;

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
