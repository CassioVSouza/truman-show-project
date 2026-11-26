export function hash32(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b >>> 0), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
/** Uniform [0,1) from (seed, counter); stateless. */
export function unitAt(seed: number, counter: number): number {
  return hash32(hash32(seed, counter), 0x1234567) / 4294967296;
}
/** Hash a string key into an integer. */
export function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}
export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
