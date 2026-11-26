// The Interpreter prompt. It never sees the persona (doc 03): it only reads a stimulus, the action with its
// expectation, and the factual outcome, and answers with hidden appraisal numbers that go to the organism.
// Its output is never shown to the Resident.
import { z } from "zod";
import type { BuiltPrompt } from "./build";

const Fields = z
  .object({
    stimulus: z.string().max(8000),
    action: z.string().max(600),
    intent: z.string().max(400),
    expectation: z.string().max(400),
    outcome: z.string().max(4000),
  })
  .strict();
export type InterpreterInput = z.infer<typeof Fields>;

const SYSTEM = `You rate how an event lands on the subject, as numbers. You do not roleplay and you do not write prose.
Answer with one JSON object only:
{"appraisal":{"novelty":0..1,"pleasantness":-1..1,"goal_relevance":0..1,"goal_congruence":-1..1,"predictedness":0..1,"controllability":0..1,"agency":"self"|"other"|"world","self_compatibility":-1..1,"social_relevance":0..1,"threat":0..1,"loss":0..1,"vastness_beauty":0..1,"contamination":0..1,"anticipation":0..1},"consequences":["short factual consequence"],"prediction_error":0..1}
prediction_error is how far the outcome was from what the subject expected. When the place where the subject was, or what was near, shaped the outcome, include that in consequences. consequences lists plain facts about the world that changed (at most five).`;

export function buildInterpreterPrompt(input: InterpreterInput): BuiltPrompt {
  const i = Fields.parse(input);
  const body = [
    `STIMULUS\n${i.stimulus}`,
    `ACTION\n${i.action}\nintent: ${i.intent}\nexpectation: ${i.expectation}`,
    `FACTUAL OUTCOME\n${i.outcome}`,
  ].join("\n\n");
  return { system: SYSTEM, messages: [{ role: "user", content: body }] };
}
