import { vitals } from "@truman/body";
import type { Rpc } from "../api";
import { DEFAULT_GOVERNOR, type Lease } from "../governor";
import { physiologyNow } from "./senses";
import { genesis } from "./state";

export type StartResult = "started" | "already_started" | "busy";

/** Initializes at most one Resident. The shared lease also protects the tick's parallel state reads. */
export async function startResident(
  db: Rpc,
  lease: Lease,
  now: () => Date = () => new Date(),
): Promise<StartResult> {
  const holder = `genesis-${crypto.randomUUID()}`;
  if (!(await lease.acquire(holder, now(), DEFAULT_GOVERNOR.leaseTtlMs))) return "busy";

  try {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    const born = now();
    const mind = genesis(seed, born.getTime());
    mind.physiology = physiologyNow(mind);
    const result = await db.rpc("admin_start_resident", {
      p_holder: holder,
      p_born_at: born.toISOString(),
      p_mind: mind,
      p_vitals: vitals(mind.body),
    });
    if (result === "started" || result === "already_started" || result === "busy") return result;
    throw new Error("Unexpected Resident initialization result");
  } finally {
    await lease.release(holder).catch(() => undefined);
  }
}
