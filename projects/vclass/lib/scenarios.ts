export interface ScenarioMeta {
  language: string;
  level: string;
  type: string;
  scenario: string;
  label: string;
}

export interface StudyType {
  id: string;
  label: string;
  scenarios: ScenarioMeta[];
}

export interface Level {
  id: string;
  label: string;
  description: string;
  types: StudyType[];
}

export interface Language {
  id: string;
  label: string;
  levels: Level[];
}

export const LANGUAGES: Language[] = [
  {
    id: "japanese",
    label: "Japanese",
    levels: ["N5", "N4", "N3", "N2", "N1"].map((lvl, i) => {
      const meta = [
        { label: "N5 — Beginner",          description: "Basic survival phrases" },
        { label: "N4 — Elementary",         description: "Elementary daily conversation" },
        { label: "N3 — Intermediate",       description: "Intermediate conversation" },
        { label: "N2 — Upper Intermediate", description: "Upper intermediate conversation" },
        { label: "N1 — Advanced",           description: "Near-native proficiency" },
      ][i];
      const roleplay = [
        { language: "japanese", level: lvl, type: "roleplay", scenario: "first_meeting",     label: "First Meeting" },
        { language: "japanese", level: lvl, type: "roleplay", scenario: "haircut",            label: "Haircut" },
        { language: "japanese", level: lvl, type: "roleplay", scenario: "arubaito_interview", label: "Arubaito Interview" },
      ];
      return { id: lvl, label: meta.label, description: meta.description, types: [{ id: "roleplay", label: "Roleplay", scenarios: roleplay }] };
    }),
  },
  {
    id: "english",
    label: "English",
    levels: ["A1", "A2", "B1", "B2", "C1", "C2"].map((lvl, i) => {
      const meta = [
        { label: "A1 — Beginner",          description: "Basic survival phrases" },
        { label: "A2 — Elementary",         description: "Elementary daily conversation" },
        { label: "B1 — Intermediate",       description: "Intermediate conversation" },
        { label: "B2 — Upper Intermediate", description: "Upper intermediate conversation" },
        { label: "C1 — Advanced",           description: "Advanced proficiency" },
        { label: "C2 — Mastery",            description: "Near-native proficiency" },
      ][i];
      const roleplay = [
        { language: "english", level: lvl, type: "roleplay", scenario: "first_meeting", label: "First Meeting" },
        { language: "english", level: lvl, type: "roleplay", scenario: "haircut",        label: "Haircut" },
        { language: "english", level: lvl, type: "roleplay", scenario: "job_interview",  label: "Job Interview" },
      ];
      return { id: lvl, label: meta.label, description: meta.description, types: [{ id: "roleplay", label: "Roleplay", scenarios: roleplay }] };
    }),
  },
];
