const RULES: Array<{ keywords: string[]; expression: string }> = [
  {
    expression: "sad",
    keywords: ["悲し", "ごめん", "申し訳", "残念", "つらい", "難し"],
  },
  {
    expression: "surprised",
    keywords: ["びっくり", "えー", "本当", "まさか", "そうですか", "！！", "えっ"],
  },
  {
    expression: "angry",
    keywords: ["だめ", "いけない", "違う", "怒", "困り"],
  },
  {
    expression: "happy",
    keywords: ["ありがとう", "嬉し", "よかった", "楽し", "すごい", "いいです", "はい", "よろしく", "喜"],
  },
];

export function detectEmotion(text: string): string {
  for (const { keywords, expression } of RULES) {
    if (keywords.some((k) => text.includes(k))) return expression;
  }
  return "relaxed";
}
