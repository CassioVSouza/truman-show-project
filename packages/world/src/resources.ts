// Resource nodes: capacity, logistic regrowth with season/weather modulation, gentle-start ramp.
import { NODE_DEFS, WORLD_CONFIG, type WorldConfig } from "./config";
import { abundanceRamp, seasonAt, weatherAt, type Clock } from "./climate";
import type { ResourceNode, Season } from "./types";

/** Capacity the node tends toward right now (units). */
export function effectiveCapacity(n: ResourceNode, season: Season, ramp: number): number {
  const d = NODE_DEFS[n.kind];
  if (n.kind === "woodpile") return n.cap; // finite stock, no ramp
  return n.cap * d.seasonCap[season] * ramp;
}

/** Initial amounts at genesis (abundance ramp at its maximum). */
export function seedNodes(nodes: ResourceNode[], cfg: WorldConfig = WORLD_CONFIG): ResourceNode[] {
  const season = seasonAt(0, cfg);
  const ramp = abundanceRamp(0, cfg);
  return nodes.map((n) => ({ ...n, amount: effectiveCapacity(n, season, ramp) }));
}

/** One hourly regrowth step evaluated at time `atT` (the hour that just ended is atT-1). */
export function regrowStep(
  nodes: ResourceNode[],
  w: Clock,
  atT: number,
  cfg: WorldConfig = WORLD_CONFIG,
): ResourceNode[] {
  const r = cfg.resources;
  const season = seasonAt(atT - 1, cfg);
  const ramp = abundanceRamp(atT, cfg);
  const wx = weatherAt(w, atT - 1, cfg);
  const raining = wx.kind === "rain" || wx.kind === "snow" ? wx.precip : 0;
  return nodes.map((n) => {
    const d = NODE_DEFS[n.kind];
    if (n.kind === "woodpile") return n;
    const K = effectiveCapacity(n, season, ramp);
    let a = n.amount;
    if (a > K) {
      a += (K - a) * r.overflowDecay;
    } else if (d.regrow > 0 && K > 0) {
      const rate = d.regrow * d.seasonRegrow[season] * ramp * (1 + d.rainRegrow * raining);
      const base = Math.max(a, r.seedFraction * K);
      a += rate * base * (1 - a / K);
      if (a > K) a = K;
    }
    return a === n.amount ? n : { ...n, amount: a };
  });
}

export function nodeItem(n: ResourceNode): string {
  const d = NODE_DEFS[n.kind];
  return n.lookalike && d.lookalikeItem ? d.lookalikeItem : d.item;
}
