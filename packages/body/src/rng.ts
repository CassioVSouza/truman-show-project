// Stateless, serialisable PRNG: every draw is hash(seed, counter). No global state.
export function hash32(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b >>> 0), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Uniform [0,1) from (seed, counter). */
export function unitAt(seed: number, counter: number): number {
  return hash32(hash32(seed, counter), 0x1234567) / 4294967296;
}

export interface RngHolder {
  seed: number;
  rng_ctr: number;
}

/** Draw the next uniform number from a state holder (advances its counter). */
export function draw(h: RngHolder): number {
  h.rng_ctr += 1;
  return unitAt(h.seed, h.rng_ctr);
}

export function drawRange(h: RngHolder, lo: number, hi: number): number {
  return lo + (hi - lo) * draw(h);
}

export function pick<T>(h: RngHolder, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(draw(h) * items.length))] as T;
}
