// The dream prompt (doc 02 sleep ticks, doc 08 memory coupling, doc 11 temperature 0.85). The dreamer is the
// Resident, so the persona is the system text. Input is only the Resident's own remembered lines (plain prose,
// no ids, no numbers): no hidden state, no scripted content, no instruction about what to dream.
import { z } from "zod";
import { neutraliseMarkers, type BuiltPrompt } from "./build";
import { PERSONA } from "./persona";

export const DreamOutput = z.object({ dream: z.string().trim().min(1).max(1500) }).strict();
export type DreamOutputT = z.infer<typeof DreamOutput>;

const Fields = z.object({ memories: z.array(z.string().max(4000)).min(1).max(20) }).strict();
export type DreamInput = z.infer<typeof Fields>;

export const DREAM_TEMPERATURE = 0.85;
export const DREAM_MAX_TOKENS = 500;

export function buildDreamPrompt(input: DreamInput): BuiltPrompt {
  const i = Fields.parse(input);
  const body = [
    `[WHAT YOU REMEMBER]\n${i.memories.map(neutraliseMarkers).join("\n")}`,
    `[YOU SLEPT]\nYou slept and you dreamed. Tell the dream as you saw it, in the first person.\nAnswer with one JSON object only: {"dream":"..."}`,
  ].join("\n\n");
  return { system: `[WHO YOU ARE]\n${PERSONA}`, messages: [{ role: "user", content: body }] };
}
