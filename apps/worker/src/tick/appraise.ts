// Appraisal (doc 03 section 3, doc 08): rule tables for routine events, the Interpreter LLM for meaningful ones.
// The Interpreter never sees the persona. Its output goes to the organism and the Lab only, never to the Resident.
import { InterpreterOutput, type Appraisal } from "@truman/contracts";
import { applyAppraisal, ruleAppraisal } from "@truman/organism";
import { LLMError, type LlmClient } from "../llm";
import { buildInterpreterPrompt } from "../prompts";
import type { ExecOutcome } from "./engine";
import type { MindState } from "./state";

export interface Appraised {
  mind: MindState;
  appraisal: Appraisal;
  source: "rules" | "interpreter";
  prediction_error: number;
  consequences: string[];
  /** Why the Interpreter was not used, when it was wanted. */
  note?: string;
}

const REPEATABLE = new Set(["walk", "quiet", "rest", "sleep"]);

export async function appraise(
  mind: MindState,
  out: ExecOutcome,
  said: { action: string; intent: string; expectation: string },
  client: LlmClient | null,
): Promise<Appraised> {
  let appraisal: Appraisal = ruleAppraisal(
    out.key === mind.prev_key && out.ok && REPEATABLE.has(out.routine)
      ? "repeat_action"
      : out.routine,
  );
  let source: Appraised["source"] = "rules";
  let prediction_error =
    out.routine === "sickened" || out.routine === "minor_injury" ? 0.8 : out.ok ? 0.1 : 0.6;
  let consequences: string[] = [];
  let note: string | undefined;

  if (out.meaningful) {
    if (!client) note = "interpreter not allowed this tick (rule tables used)";
    else {
      try {
        const p = buildInterpreterPrompt({
          stimulus: out.stimulus,
          action: said.action,
          intent: said.intent,
          expectation: said.expectation,
          outcome: out.text,
        });
        const r = await client.generate({
          role: "interpreter",
          system: p.system,
          messages: p.messages,
          schema: InterpreterOutput,
          temperature: 0.2,
          maxOutputTokens: 500,
        });
        appraisal = r.data.appraisal;
        prediction_error = r.data.prediction_error;
        consequences = r.data.consequences;
        source = "interpreter";
      } catch (e) {
        note = `interpreter failed (rule tables used): ${e instanceof LLMError ? e.kind : "error"}`;
      }
    }
  }
  return {
    mind: { ...mind, organism: applyAppraisal(mind.organism, appraisal, out.key) },
    appraisal,
    source,
    prediction_error,
    consequences,
    note,
  };
}
