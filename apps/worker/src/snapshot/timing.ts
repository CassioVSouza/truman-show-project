import { pickMode, type Budget, type GovernorConfig } from "../governor";
import type { LlmProvider } from "../llm";
import { isoAt, worldTimeAt, type MindState } from "../tick/state";

const MINUTE_MS = 60_000;
const UTC_DAY_MS = 86_400_000;

/** Dispatch can lag the cron timestamp. Report a future slot on the same nominal schedule. */
export function nextTickTime(
  startedMs: number,
  scheduledAtMs: number | undefined,
  cadence: number,
): number {
  const origin = scheduledAtMs ?? 0;
  const step = cadence * MINUTE_MS;
  return origin + (Math.max(0, Math.floor((startedMs - origin) / step)) + 1) * step;
}

/** Earliest nominal slot when the committed state and known budget allow a decision. */
export function nextDecisionTime(
  nextTickMs: number,
  mind: MindState,
  budget: Budget,
  cfg: GovernorConfig,
  providers: readonly LlmProvider[],
): number | null {
  if (!mind.body.alive || providers.length === 0) return null;

  const step = cfg.tickMinutes * MINUTE_MS;
  const lastDecisionMs = mind.last_decision_ms ?? Date.parse(isoAt(mind, mind.last_decision_t));
  const notBefore = Math.max(Date.parse(isoAt(mind, mind.world.t)), lastDecisionMs + step);
  const first = nextTickMs + Math.max(0, Math.ceil((notBefore - nextTickMs) / step)) * step;
  const kv = { budget };
  const initial = pickMode(kv, new Date(first), cfg);
  const hasProvider = (b: Budget): boolean => providers.some((p) => !b.exhausted.includes(p.id));
  if (initial.mode === "idle" || initial.mode === "hibernating" || !hasProvider(initial.budget)) {
    return null;
  }

  const eligible = (slot: number, plan = pickMode(kv, new Date(slot), cfg)): boolean =>
    plan.allowDecide &&
    slot >= lastDecisionMs + plan.decisionIntervalMin * MINUTE_MS &&
    mind.world.t <= worldTimeAt(mind, slot) + 1e-6;
  if (eligible(first, initial)) return first;

  // Before the UTC reset, the budget can only release more paced calls, and the
  // decision interval can only fall. Search eligible slots without iterating all of them.
  const reset = (Math.floor(first / UTC_DAY_MS) + 1) * UTC_DAY_MS;
  let lo = 1;
  let hi = Math.ceil((reset - first) / step); // First slot at or after the reset also clears budgets.
  if (!eligible(first + hi * step)) return null;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (eligible(first + mid * step)) hi = mid;
    else lo = mid + 1;
  }
  return first + lo * step;
}
