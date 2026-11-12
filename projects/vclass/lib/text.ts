/** Remove furigana annotations like `漢字 [かんじ]`, keeping only the base text. */
export const stripFurigana = (text: string): string => text.replace(/\s*\[[^\]]+\]/g, "");
