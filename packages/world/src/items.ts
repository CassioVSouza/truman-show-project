// Items, inventory operations, spoilage and food effects. Pure functions.
import { ITEM_DEFS, STARTER_KIT, WORLD_CONFIG, type ItemDef, type WorldConfig } from "./config";
import { ambientTempOutside, type Clock } from "./climate";
import type { Inventory } from "./types";

type Stack = Inventory[number];

export function itemDef(id: string): ItemDef | undefined {
  return ITEM_DEFS[id];
}

const sameProps = (a?: Record<string, unknown>, b?: Record<string, unknown>): boolean =>
  JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

export function invCount(inv: Inventory, item: string): number {
  return inv.filter((s) => s.item === item).reduce((n, s) => n + s.qty, 0);
}

export function invAdd(
  inv: Inventory,
  item: string,
  qty: number,
  opts: { condition?: number; props?: Record<string, unknown> } = {},
): Inventory {
  if (qty <= 0) return inv;
  const cond = opts.condition ?? 1;
  const out = inv.map((s) => ({ ...s }));
  const hit = out.find((s) => s.item === item && sameProps(s.props, opts.props));
  if (hit && item !== "water_jar") {
    const c0 = hit.condition ?? 1;
    hit.condition = (c0 * hit.qty + cond * qty) / (hit.qty + qty);
    hit.qty += qty;
  } else {
    const s: Stack = { item, qty, condition: cond };
    if (opts.props) s.props = { ...opts.props };
    out.push(s);
  }
  return out;
}

/** Removes up to `qty` from the first matching stacks; returns the new inventory and how many were removed. */
export function invRemove(
  inv: Inventory,
  item: string,
  qty: number,
): { inventory: Inventory; removed: number } {
  let left = qty;
  const out: Inventory = [];
  for (const s of inv) {
    if (s.item === item && left > 0) {
      const take = Math.min(s.qty, left);
      left -= take;
      if (s.qty - take > 0) out.push({ ...s, qty: s.qty - take });
    } else out.push({ ...s });
  }
  return { inventory: out, removed: qty - left };
}

export function starterInventory(): Inventory {
  let inv: Inventory = [];
  for (const k of STARTER_KIT) {
    const opts: { props?: Record<string, unknown> } = {};
    if (k.props) opts.props = k.props;
    inv = invAdd(inv, k.item, k.qty, opts);
  }
  return inv;
}

/** Resolve a free-text name ("the jar", "berries", "dried food") to an inventory stack. */
export function findItem(inv: Inventory, text: string): Stack | undefined {
  const t = text.toLowerCase().trim();
  if (!t) return undefined;
  let best: Stack | undefined;
  let score = 0;
  for (const s of inv) {
    if (s.qty <= 0) continue;
    const def = ITEM_DEFS[s.item];
    if (!def) continue;
    let sc = 0;
    if (t === s.item || t === s.item.replace(/_/g, " ")) sc = 100;
    else if (t === def.noun || t === def.plural) sc = 90;
    else {
      for (const w of [...def.words, def.noun, def.plural]) {
        if (t.includes(w)) sc = Math.max(sc, w.length + 10);
        else if (w.includes(t) && t.length >= 3) sc = Math.max(sc, t.length);
      }
    }
    if (sc > score) {
      score = sc;
      best = s;
    }
  }
  return best;
}

const WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
const num = (n: number): string => (n < WORDS.length ? (WORDS[n] as string) : "many");

/** Plain-language description of one stack, e.g. "six portions of dried food". */
export function describeStack(s: Stack): string {
  const def = ITEM_DEFS[s.item];
  if (!def) return s.item.replace(/_/g, " ");
  let base: string;
  if (s.qty === 1) base = /^[aeiou]/.test(def.noun) ? `an ${def.noun}` : `a ${def.noun}`;
  else base = `${num(s.qty)} ${def.plural}`;
  if (s.item === "water_jar") {
    const fill = Number((s.props as { fill?: number } | undefined)?.fill ?? 0);
    base +=
      fill <= 0 ? ", empty" : fill >= WORLD_CONFIG.water.jarDrinks ? ", full" : ", partly filled";
  }
  if ((s.props as { worn?: boolean } | undefined)?.worn) base += ", worn";
  const cond = s.condition ?? 1;
  if ((def.spoilPerHour ?? 0) > 0) {
    if (cond < 0.25) base += " (rotten)";
    else if (cond < 0.6) base += " (going bad)";
  }
  return base;
}

export function describeInventory(inv: Inventory): string {
  const parts = inv.filter((s) => s.qty > 0).map(describeStack);
  return parts.length ? `You are carrying ${parts.join("; ")}.` : "You are carrying nothing.";
}

/** Sum of insulation of worn items (0..1). Blankets count only when worn. */
export function wornInsulation(inv: Inventory): number {
  let sum = 0;
  for (const s of inv) {
    const def = ITEM_DEFS[s.item];
    if (def?.insulation && (s.props as { worn?: boolean } | undefined)?.worn) sum += def.insulation;
  }
  return Math.min(1, sum);
}

export function spoilFactor(tempC: number, cfg: WorldConfig = WORLD_CONFIG): number {
  const f = cfg.food;
  return Math.max(f.spoilTempMin, 1 + (tempC - f.spoilTempRef) * f.spoilTempSlope);
}

/** Apply spoilage between two times. Steps only at clock-hour boundaries so any step size gives the same result. */
export function advanceInventory(
  inv: Inventory,
  w: Clock,
  fromT: number,
  toT: number,
  cfg: WorldConfig = WORLD_CONFIG,
): Inventory {
  if (toT <= fromT) return inv;
  let out = inv;
  let t = nextHourT(w, fromT);
  while (t <= toT) {
    const f = spoilFactor(ambientTempOutside(w, t - 1, cfg), cfg);
    out = out.map((s) => {
      const rate = ITEM_DEFS[s.item]?.spoilPerHour ?? 0;
      return rate > 0 ? { ...s, condition: Math.max(0, (s.condition ?? 1) - rate * f) } : s;
    });
    t += 60;
  }
  return out;
}

/** First t strictly after `t` that lies on a clock-hour boundary. */
export function nextHourT(w: Clock, t: number): number {
  const c = w.genesisClock + t;
  return t + (60 - (((c % 60) + 60) % 60));
}

export interface FoodEffects {
  satiety: number;
  energy_reserve: number;
  hydration: number;
  illness_chance: number; // 0..1, before the body's own immunity
  nutrient: string | null;
  medicinal: boolean;
}

export function foodEffects(
  item: string,
  condition = 1,
  cfg: WorldConfig = WORLD_CONFIG,
): FoodEffects | null {
  const d = ITEM_DEFS[item];
  if (!d || d.kind !== "food") return null;
  const f = cfg.food;
  const k = f.satietyFloor + (1 - f.satietyFloor) * condition;
  let ill = d.toxicity ?? 0;
  if (condition < f.spoilIllnessBelow) {
    ill = Math.min(
      1,
      ill + ((f.spoilIllnessBelow - condition) / f.spoilIllnessBelow) * f.spoilIllnessMax,
    );
  }
  return {
    satiety: (d.satiety ?? 0) * k,
    energy_reserve: (d.reserve ?? 0) * k,
    hydration: d.hydration ?? 0,
    illness_chance: ill,
    nutrient: d.nutrient ?? null,
    medicinal: !!d.medicinal,
  };
}
