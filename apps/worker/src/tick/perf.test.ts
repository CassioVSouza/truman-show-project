// CPU proxy for Workers Free using a fully in-memory tick. Production CPU comes
// from deployed analytics. SimDb includes the cost of parsing and serializing state.
import { expect, test } from "vitest";
import { DEFAULT_GOVERNOR } from "../governor";
import { LogWriter } from "../log";
import { MemoryRows } from "./memory-log";
import { runMindTick } from "./pipeline";
import { SimDb, makeAgent } from "./testkit";

test("a steady-state tick stays under the 10 ms CPU budget (proxy)", async () => {
  const db = new SimDb();
  const agent = makeAgent(db);
  const start = Date.parse("2026-03-01T06:30:00Z");
  const ticksPerDay = 1440 / DEFAULT_GOVERNOR.tickMinutes;
  const tick = async (k: number) => {
    const t = new Date(start + k * DEFAULT_GOVERNOR.tickMinutes * 60_000);
    // Count compute in this Vitest process independently of other suites running in parallel.
    const t0 = process.cpuUsage();
    const r = await runMindTick({
      db,
      log: new LogWriter(),
      rows: new MemoryRows(),
      providers: [agent],
      now: () => t,
    });
    const cpu = process.cpuUsage(t0);
    return { ms: (cpu.user + cpu.system) / 1_000, step: r.step };
  };
  let k = 0;
  for (; k < ticksPerDay; k++) await tick(k); // a lived-in state, not genesis
  const decided: number[] = [];
  const quiet: number[] = [];
  for (let i = 0; i < ticksPerDay; i++) {
    const r = await tick(k++);
    (r.step === "decided" ? decided : quiet).push(r.ms);
  }
  const q = (xs: number[], f: number) =>
    [...xs].sort((a, b) => a - b)[Math.floor(f * (xs.length - 1))] ?? 0;
  const stateKb = Math.round(JSON.stringify(db.kv["mind"]).length / 1024);
  process.stdout.write(
    `tick ms (node proxy): decided p50=${q(decided, 0.5).toFixed(2)} p95=${q(decided, 0.95).toFixed(2)} max=${Math.max(...decided).toFixed(2)} n=${decided.length}; quiet p50=${q(quiet, 0.5).toFixed(2)} p95=${q(quiet, 0.95).toFixed(2)}; mind=${stateKb} KB\n`,
  );
  expect(decided.length).toBeGreaterThan(20);
  expect(q(decided, 0.5)).toBeLessThan(10);
  expect(q(quiet, 0.5)).toBeLessThan(10);
});
