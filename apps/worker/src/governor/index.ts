// Phase 0: only the kill switch / pause gate. Budgets, modes and lease arrive with the governor task.
export type GateDecision = { run: true } | { run: false; reason: string };

/**
 * Coerces a kv flag. Fails closed: true, 1, "true", "1", "yes", "on" (any case, trimmed) mean ON; false, 0,
 * "false", "0", "no", "off", "", null and undefined mean OFF; anything else (garbage, objects) is treated as ON,
 * so a malformed kill/pause flag stops the Resident instead of letting it run.
 */
export function flagOn(v: unknown): boolean {
  if (v === undefined || v === null || v === false || v === 0) return false;
  if (v === true || v === 1) return true;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (["", "false", "0", "no", "off", "null"].includes(t)) return false;
    return true;
  }
  return true;
}

export function gate(
  kv: Record<string, unknown>,
  resident: Record<string, unknown> | null,
): GateDecision {
  if (flagOn(kv["kill_switch"])) return { run: false, reason: "kill_switch" };
  if (flagOn(kv["paused"])) return { run: false, reason: "paused" };
  if (!resident) return { run: false, reason: "no_resident" };
  if (resident["status"] === "dead") return { run: false, reason: "dead" }; // death is permanent
  return { run: true };
}
