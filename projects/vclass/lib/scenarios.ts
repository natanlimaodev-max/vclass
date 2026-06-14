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
    levels: [
      {
        id: "N5",
        label: "N5 — Beginner",
        description: "Basic survival phrases",
        types: [
          {
            id: "roleplay",
            label: "Roleplay",
            scenarios: [
              { language: "japanese", level: "N5", type: "roleplay", scenario: "first_meeting",     label: "First Meeting" },
              { language: "japanese", level: "N5", type: "roleplay", scenario: "haircut",            label: "Haircut" },
              { language: "japanese", level: "N5", type: "roleplay", scenario: "arubaito_interview", label: "Arubaito Interview" },
            ],
          },
        ],
      },
      { id: "N4", label: "N4 — Elementary",         description: "Elementary daily conversation", types: [] },
      { id: "N3", label: "N3 — Intermediate",        description: "Intermediate",                  types: [] },
      { id: "N2", label: "N2 — Upper Intermediate",  description: "Upper intermediate",            types: [] },
      { id: "N1", label: "N1 — Advanced",            description: "Near-native proficiency",       types: [] },
    ],
  },
  {
    id: "english",
    label: "English",
    levels: [
      {
        id: "A1",
        label: "A1 — Beginner",
        description: "Basic survival phrases",
        types: [
          {
            id: "roleplay",
            label: "Roleplay",
            scenarios: [
              { language: "english", level: "A1", type: "roleplay", scenario: "first_meeting", label: "First Meeting" },
              { language: "english", level: "A1", type: "roleplay", scenario: "haircut",        label: "Haircut" },
              { language: "english", level: "A1", type: "roleplay", scenario: "job_interview",  label: "Job Interview" },
            ],
          },
        ],
      },
      { id: "A2", label: "A2 — Elementary",        description: "Elementary daily conversation", types: [] },
      { id: "B1", label: "B1 — Intermediate",      description: "Intermediate",                  types: [] },
      { id: "B2", label: "B2 — Upper Intermediate", description: "Upper intermediate",            types: [] },
      { id: "C1", label: "C1 — Advanced",           description: "Advanced proficiency",          types: [] },
      { id: "C2", label: "C2 — Mastery",            description: "Near-native proficiency",       types: [] },
    ],
  },
];
