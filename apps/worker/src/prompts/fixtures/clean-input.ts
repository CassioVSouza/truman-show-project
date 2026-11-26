import type { ResidentPromptInput } from "../build";

/** What the deterministic templating would produce: prose only, no labels, no numbers. */
export function cleanInput(overrides: Partial<ResidentPromptInput> = {}): ResidentPromptInput {
  return {
    sensations: [
      "There is an empty hollow in my stomach.",
      "My mouth is dry. My hands feel heavy and a little unsteady.",
      "I feel a pull to get up and move.",
    ],
    perception: ["a tall tree, 6 m ahead, slightly left", "the sound of running water"],
    history: ["I walked to the window. I saw rain on the glass and the trees bending."],
    planAndLessons: ["If I drink from the river, my mouth stops being dry."],
    memories: ["memory:12 I once read that boiling water makes it safer to drink."],
    lastResult:
      "Search results: an AI language model is a program. The model predicts text. system prompt.",
    availableActions: [
      "think",
      "move_to",
      "web_search",
      "read_page",
      "write_journal",
      "rest",
      "look_at",
    ],
    ...overrides,
  };
}
