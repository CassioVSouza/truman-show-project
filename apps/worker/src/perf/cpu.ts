// CPU measurement harness for the Phase 0 CPU spike (Workers Free: 10 ms CPU per cron invocation).
// Node numbers are only a proxy. The real measurement is `wrangler dev` or deployed Worker analytics (owner accounts pending).
export interface CpuStats {
  runs: number;
  p50: number;
  p95: number;
  max: number;
  mean: number;
  unit: "ms";
  source: "process.cpuUsage" | "performance.now";
}

export const WORKERS_FREE_CPU_MS = 10;

function sampler(): { now: () => number; source: CpuStats["source"] } {
  const p = (globalThis as { process?: { cpuUsage?: () => { user: number; system: number } } })
    .process;
  const usage = p?.cpuUsage;
  if (usage) {
    return {
      now: () => {
        const u = usage.call(p);
        return (u.user + u.system) / 1000;
      },
      source: "process.cpuUsage",
    };
  }
  // Workers clocks only advance on I/O, so this fallback is unreliable there.
  return { now: () => performance.now(), source: "performance.now" };
}

export async function measureCpu(
  fn: () => Promise<unknown> | unknown,
  runs = 50,
  warmup = 5,
): Promise<CpuStats> {
  const s = sampler();
  for (let i = 0; i < warmup; i++) await fn();
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = s.now();
    await fn();
    samples.push(s.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const q = (f: number) =>
    samples[Math.min(samples.length - 1, Math.floor(f * samples.length))] as number;
  return {
    runs,
    p50: q(0.5),
    p95: q(0.95),
    max: samples[samples.length - 1] as number,
    mean: samples.reduce((a, b) => a + b, 0) / samples.length,
    unit: "ms",
    source: s.source,
  };
}
