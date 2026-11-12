import path from "path";
import fs from "fs";

/**
 * Root of the monorepo `shared/` folder (prompts, scenario contexts, language levels).
 * Override with SHARED_DIR; otherwise the first existing candidate wins:
 * `../../shared` from the project (local dev, Docker) or `shared/` at the cwd
 * (serverless bundles that run from the repository root).
 */
function resolveSharedDir(): string {
  if (process.env.SHARED_DIR) return path.resolve(process.env.SHARED_DIR);
  const candidates = [
    path.join(process.cwd(), "../../shared"),
    path.join(process.cwd(), "shared"),
  ].map((p) => path.resolve(p));
  return candidates.find((p) => fs.existsSync(path.join(p, "languages"))) ?? candidates[0];
}

export const SHARED_DIR = resolveSharedDir();

const SLUG = /^[a-z0-9_]+$/;

export class ValidationError extends Error {}

interface LanguageFile {
  code: string;
  levels: Array<{ code: string; grammar_notes?: string }>;
}

/** Resolve a path inside SHARED_DIR, refusing anything that escapes it. */
function sharedPath(...parts: string[]): string {
  const p = path.resolve(SHARED_DIR, ...parts);
  if (p !== SHARED_DIR && !p.startsWith(SHARED_DIR + path.sep)) {
    throw new ValidationError("Invalid path");
  }
  return p;
}

function readShared(...parts: string[]): string {
  return fs.readFileSync(sharedPath(...parts), "utf-8");
}

/** Languages are whatever has a `shared/languages/<code>.json` file. */
export function listLanguages(): string[] {
  return fs
    .readdirSync(sharedPath("languages"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length));
}

export function assertLanguage(language: unknown): string {
  if (typeof language !== "string" || !SLUG.test(language) || !listLanguages().includes(language)) {
    throw new ValidationError("Unknown language");
  }
  return language;
}

function loadLanguage(language: string): LanguageFile {
  return JSON.parse(readShared("languages", `${language}.json`)) as LanguageFile;
}

function findContextFile(language: string, level: string, scenario: string): string | null {
  const candidates = [
    sharedPath("contexts", language, `${scenario}.md`),
    sharedPath("contexts", language, level, `${scenario}.md`),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

export interface ScenarioParams {
  language: string;
  level: string;
  scenario: string;
}

/** Validate language/level/scenario against the files in `shared/`. Throws ValidationError. */
export function validateScenario(input: {
  language?: unknown;
  level?: unknown;
  scenario?: unknown;
}): ScenarioParams {
  const language = assertLanguage(input.language);
  const { level, scenario } = input;
  if (typeof level !== "string" || !loadLanguage(language).levels.some((l) => l.code === level)) {
    throw new ValidationError("Unknown level");
  }
  if (typeof scenario !== "string" || !SLUG.test(scenario) || !findContextFile(language, level, scenario)) {
    throw new ValidationError("Unknown scenario");
  }
  return { language, level, scenario };
}

/** Build the roleplay system prompt entirely on the server from validated params. */
export function buildSystemPrompt({ language, level, scenario }: ScenarioParams): string {
  const file = findContextFile(language, level, scenario);
  if (!file) throw new ValidationError("Unknown scenario");
  const context = fs.readFileSync(file, "utf-8").replace(/^---[\s\S]*?---\n/, "").trim();

  const notes = loadLanguage(language).levels.find((l) => l.code === level)?.grammar_notes;
  const parts = [context];
  if (notes) parts.push(`## Language Constraints (${level})\n${notes}`);
  if (language === "japanese") parts.push(readShared("prompts", "japanese", "furigana.txt"));
  return parts.join("\n\n");
}

/**
 * Load `shared/prompts/<language>/<name>.txt` and fill `{sentence}`.
 * Read on every call so prompt edits apply without a restart.
 */
export function renderPrompt(language: string, name: "grammar" | "explain", sentence: string): string | null {
  const file = sharedPath("prompts", language, `${name}.txt`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf-8").replace("{sentence}", () => sentence);
}
