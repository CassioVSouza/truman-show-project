import type { Skills } from "./types";

/** Starting competence (docs/10 section 3). Capability, not story: the Resident still chooses. */
export const STARTING_SKILLS: Skills = {
  drinking_water_safety: 30,
  foraging: 25,
  fire_making: 25,
  fire_tending: 25,
  shelter_warmth: 20,
  first_aid: 20,
  cooking: 15,
  woodcutting: 10,
  fishing: 0,
  crafting: 0,
};

export const SKILL_LEARN_RATE = 6; // points per full-quality practice unit at level 0

/** Practice-based learning with diminishing returns. `quality` 0..1 (success teaches more). */
export function practice(
  skills: Skills,
  name: string,
  units = 1,
  quality = 1,
  rate = SKILL_LEARN_RATE,
): Skills {
  const cur = skills[name] ?? 0;
  const gain = rate * units * Math.max(0, Math.min(1, quality)) * (1 - cur / 100);
  return { ...skills, [name]: Math.min(100, cur + gain) };
}

const HINT_BANDS: [number, string][] = [
  [8, "your hands are clumsy and unsure at"],
  [30, "your hands have only a little practice at"],
  [60, "your hands have some practice at"],
  [85, "your hands are practiced at"],
  [101, "your hands are quick and sure at"],
];

const SKILL_PHRASE: Record<string, string> = {
  drinking_water_safety: "judging which water to drink",
  foraging: "picking things to eat from the ground and bushes",
  fire_making: "starting a fire",
  fire_tending: "keeping a fire alive",
  shelter_warmth: "keeping warm with layers and cover",
  first_aid: "cleaning and binding wounds",
  cooking: "cooking",
  woodcutting: "gathering and cutting wood",
  fishing: "catching fish",
  crafting: "making things",
};

/** Short qualitative hints for [WHAT YOUR HANDS KNOW]: words only, no numbers. */
export function skillHints(skills: Skills): string[] {
  const out: string[] = [];
  for (const [name, level] of Object.entries(skills)) {
    const phrase = SKILL_PHRASE[name];
    if (!phrase) continue;
    const band = HINT_BANDS.find(([max]) => level < max);
    if (band) out.push(`${band[1][0]!.toUpperCase()}${band[1].slice(1)} ${phrase}.`);
  }
  return out;
}

/** Innate procedural know-how (docs/11): no narrative, nothing beyond basics. */
export const INNATE_KNOW_HOW: readonly string[] = [
  "You know how to drink water to ease a dry mouth.",
  "You know how to eat what is edible; some things sicken you.",
  "You know how to light a fire with flint, steel and dry tinder; fire gives warmth and light, and it burns.",
  "You know how to rest and sleep to be restored.",
  "You know how to clean and bind a wound.",
  "You know that boiling makes water safer to drink.",
  "You know that dry wood burns.",
];
