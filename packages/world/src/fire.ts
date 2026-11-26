// Fires: fuel, states, burn-down, warmth. Pure functions.
import { WORLD_CONFIG, type WorldConfig } from "./config";
import { dist } from "./map";
import type { Fire, FireState, Vec } from "./types";

export function fireState(f: Fire, t: number, cfg: WorldConfig = WORLD_CONFIG): FireState {
  const c = cfg.fire;
  if (f.fuel <= 0) return "out";
  if (f.fuel <= c.dyingBelow) return "dying";
  if (t - f.litAt < c.litMinutes) return "lit";
  return "burning";
}

/** Burn rate multiplier. Quantised to quarters so catch-up equals minute stepping exactly. */
export function burnRate(
  f: Fire,
  precip: number,
  wet: boolean,
  cfg: WorldConfig = WORLD_CONFIG,
): number {
  if (f.indoors || !wet) return 1;
  return 1 + Math.round((cfg.fire.rainBurn - 1) * precip * 4) / 4;
}

export function burn(f: Fire, from: number, to: number, rate: number): Fire {
  if (f.fuel <= 0 || to <= from) return f;
  const dt = to - from;
  const need = f.fuel / rate;
  if (dt >= need) {
    return { ...f, fuel: 0, outAt: Math.round((from + need) * 1e4) / 1e4 };
  }
  return { ...f, fuel: f.fuel - dt * rate };
}

export function nearestFire(
  fires: Fire[],
  p: Vec,
  t: number,
  maxDist: number,
  cfg: WorldConfig = WORLD_CONFIG,
): Fire | undefined {
  let best: Fire | undefined;
  let bd = maxDist;
  for (const f of fires) {
    if (fireState(f, t, cfg) === "out") continue;
    const d = dist(p, f);
    if (d <= bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

/** Radiant warmth (deg C) and whether a burn is possible at p. Room heating is added by the caller. */
export function fireHeat(
  fires: Fire[],
  p: Vec,
  t: number,
  cfg: WorldConfig = WORLD_CONFIG,
): { heat: number; adjacent: boolean } {
  const c = cfg.fire;
  let heat = 0;
  let adjacent = false;
  for (const f of fires) {
    const s = fireState(f, t, cfg);
    if (s === "out") continue;
    const d = dist(p, f);
    const r = f.indoors ? c.hearthRadius : c.radius;
    heat += c.heatMax * c.stateFactor[s] * Math.max(0, 1 - d / r) ** 2;
    if (d < c.adjacent) adjacent = true;
  }
  return { heat, adjacent };
}
