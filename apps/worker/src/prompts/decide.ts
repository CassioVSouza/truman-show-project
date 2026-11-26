// Resident-facing menu and output format, as plain lines for the [WHAT YOU CAN DO] section.
// Text only describes how to answer. No story, no moral or safety text, no numbers (decision 29).
import { Station } from "@truman/contracts";

export type ActionName =
  | "think"
  | "move_to"
  | "look_at"
  | "write_journal"
  | "rest"
  | "web_search"
  | "read_page"
  | "eat"
  | "drink"
  | "gather"
  | "chop"
  | "fish"
  | "make_fire"
  | "tend_fire"
  | "boil_water"
  | "cook"
  | "wear"
  | "treat_wound"
  | "use_item"
  | "repair_shelter";

const MENU: Record<ActionName, string> = {
  think: 'think: just think. {"type":"think"}',
  move_to: `move_to: walk somewhere. {"type":"move_to","station":"<one of: ${Station.options.join(", ")}>"}`,
  look_at: 'look_at: look closely at something. {"type":"look_at","target":"<what>"}',
  write_journal: 'write_journal: write in your journal. {"type":"write_journal","text":"<words>"}',
  rest: 'rest: lie down and rest or sleep for some hours (a whole number, one to eight). {"type":"rest","hours":<n>}',
  web_search: 'web_search: search through the terminal. {"type":"web_search","query":"<words>"}',
  read_page: 'read_page: read a page through the terminal. {"type":"read_page","url":"<address>"}',
  eat: 'eat: eat something you carry. {"type":"eat","item":"<what>"}',
  drink:
    'drink: drink from the jar or from water nearby. {"type":"drink","source":"<jar, spring, river, pool or rain>"}',
  gather: 'gather: gather what grows close by. {"type":"gather","target":"<what>"}',
  chop: 'chop: cut wood from a tree close by. {"type":"chop","target":"<what>"}',
  fish: 'fish: fish in the water close by. {"type":"fish"}',
  make_fire: 'make_fire: build a fire. {"type":"make_fire"}',
  tend_fire: 'tend_fire: feed a fire close by. {"type":"tend_fire"}',
  boil_water: 'boil_water: heat the water in the jar over a fire. {"type":"boil_water"}',
  cook: 'cook: cook something over a fire. {"type":"cook","item":"<what>"}',
  wear: 'wear: put on or take off something. {"type":"wear","item":"<what>","remove":<true or false>}',
  treat_wound: 'treat_wound: clean and bind a wound. {"type":"treat_wound"}',
  use_item:
    'use_item: use something you carry. {"type":"use_item","item":"<what>","target":"<optional>"}',
  repair_shelter: 'repair_shelter: mend the cabin. {"type":"repair_shelter"}',
};

export const ALL_ACTIONS = Object.keys(MENU) as ActionName[];

const FORMAT: string[] = [
  'Answer with one JSON object: {"review": {...}, "action": {...}}.',
  "Leave out review the very first time. Otherwise review is about what you did last:",
  '  {"what_happened":"...","cause":"...","expectation_met":"yes" or "partly" or "no","lesson":"an if-then rule you learned (optional)","feeling_description":"how it felt, in your own words","new_questions":[],"citations":[]}',
  'Put an address or "memory:<id>" in citations for anything you state from reading or remembering.',
  'Every action also carries "thought" (what you think now), "intent" (why you do it now), "expectation" (what you think will happen), and may carry "ideas": [].',
  "Where you are and what is near you are part of what any action will cost or give you, so let your intent and expectation say how the place figures in. In your review, say how the place played a part when it did.",
  "Choose one action:",
];

/** Lines for the [WHAT YOU CAN DO] section. `available` restricts the menu (e.g. no web_search when search is out). */
export function menuLines(available: readonly ActionName[]): string[] {
  return [...FORMAT, ...available.map((a) => `- ${MENU[a]}`)];
}
