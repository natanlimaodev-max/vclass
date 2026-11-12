import { describe, expect, it } from "vitest";
import { buildSystemPrompt, renderPrompt, validateScenario, ValidationError } from "@/lib/server/shared";
import { stripFurigana } from "@/lib/text";

describe("validateScenario", () => {
  it("accepts every scenario the UI offers", async () => {
    const { LANGUAGES } = await import("@/lib/scenarios");
    for (const lang of LANGUAGES)
      for (const level of lang.levels)
        for (const type of level.types)
          for (const s of type.scenarios) {
            expect(() => validateScenario(s)).not.toThrow();
            expect(buildSystemPrompt(validateScenario(s)).length).toBeGreaterThan(50);
          }
  });

  it.each([
    { language: "../../projects/vclass", level: "N5", scenario: "haircut" },
    { language: "japanese", level: "../../../etc", scenario: "haircut" },
    { language: "japanese", level: "N5", scenario: "../../../README" },
    { language: "japanese", level: "N5", scenario: "does_not_exist" },
    { language: "klingon", level: "N5", scenario: "haircut" },
    { language: "japanese", level: "A1", scenario: "haircut" },
    { language: ["japanese"], level: "N5", scenario: "haircut" },
    {},
  ])("rejects %j", (input) => {
    expect(() => validateScenario(input)).toThrow(ValidationError);
  });
});

describe("buildSystemPrompt", () => {
  it("adds level constraints and furigana rules for Japanese", () => {
    const prompt = buildSystemPrompt({ language: "japanese", level: "N5", scenario: "haircut" });
    expect(prompt).toContain("Language Constraints (N5)");
    expect(prompt).not.toMatch(/^---/);
  });
});

describe("renderPrompt", () => {
  it("inserts the sentence literally, even with $ patterns", () => {
    const out = renderPrompt("english", "grammar", "I paid $& and $1");
    expect(out).toContain("I paid $& and $1");
  });
});

describe("stripFurigana", () => {
  it("removes bracketed readings", () => {
    expect(stripFurigana("今日 [きょう]は天気 [てんき]がいい")).toBe("今日は天気がいい");
  });
});
