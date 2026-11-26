// Seeded, stateless hashing + small PRNG. Same inputs always give the same output.

export function hash32(...ns: number[]): number {
  let h = 0x9e3779b9;
  for (const n of ns) {
    h = Math.imul(h ^ (Math.floor(n) | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}

/** Uniform [0,1) from integer keys. */
export function rand01(...ns: number[]): number {
  return hash32(...ns) / 4294967296;
}

export function strHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Sequential PRNG (mulberry32) seeded from integer keys. */
export function rngFrom(...ns: number[]): () => number {
  let a = hash32(...ns);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
