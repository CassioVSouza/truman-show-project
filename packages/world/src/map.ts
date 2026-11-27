// Static map generated from the world seed: cabin, stations, trail graph, river, pool, spring, nodes.
import type { Station } from "@truman/contracts";
import { NODE_DEFS, WORLD_CONFIG, type WorldConfig } from "./config";
import { rand01, rngFrom } from "./rng";
import type { NodeKind, ResourceNode, Vec } from "./types";

export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.z - b.z);
export const polar = (angleRad: number, d: number): Vec => ({
  x: Math.sin(angleRad) * d,
  z: Math.cos(angleRad) * d,
});

export function nearestOnSegment(p: Vec, a: Vec, b: Vec): Vec {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const f = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  return { x: a.x + f * dx, z: a.z + f * dz };
}
export function nearestOnPolyline(p: Vec, line: Vec[]): Vec {
  let best = line[0] as Vec;
  let bd = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const q = nearestOnSegment(p, line[i] as Vec, line[i + 1] as Vec);
    const d = dist(p, q);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

export interface WorldMap {
  seed: number;
  radius: number;
  cabin: { halfW: number; halfD: number };
  stations: Record<Station, Vec>;
  hearth: Vec;
  spring: Vec;
  pool: Vec & { radius: number };
  river: Vec[];
  riverWidth: number;
  waypoints: Record<string, Vec>;
  edges: Record<string, string[]>;
  nodes: ResourceNode[]; // initial nodes, amounts not yet set
  campfires?: readonly Vec[]; // outdoor fire rings when planning a walk
}

const cache = new Map<number, WorldMap>();

export function generateMap(seed: number, cfg: WorldConfig = WORLD_CONFIG): WorldMap {
  const useCache = cfg === WORLD_CONFIG;
  if (useCache) {
    const hit = cache.get(seed);
    if (hit) return hit;
  }
  const m = build(seed, cfg);
  if (useCache) cache.set(seed, m);
  return m;
}

function build(seed: number, cfg: WorldConfig): WorldMap {
  const mc = cfg.map;
  const rad = (deg: number): number => (deg * Math.PI) / 180;
  const r0 = rand01(seed, 1) * 360;
  const sector = (key: number, base: number, d: number): Vec => {
    const jit = (rand01(seed, 2, key) - 0.5) * 2 * mc.jitterDeg;
    const dd = d * (1 + (rand01(seed, 3, key) - 0.5) * 2 * mc.distJitter);
    return polar(rad(r0 + base + jit), dd);
  };

  const forestEdge = sector(1, mc.forestEdge.angleDeg, mc.forestEdge.dist);
  const clearing = sector(2, mc.clearing.angleDeg, mc.clearing.dist);
  const spring = sector(3, mc.spring.angleDeg, mc.spring.dist);
  const poolC = sector(4, mc.mirrorPool.angleDeg, mc.mirrorPool.dist);
  const riverMid = sector(5, mc.river.angleDeg, mc.river.dist);

  // River: a gently wobbling line perpendicular to the radial direction through riverMid.
  const rl = Math.hypot(riverMid.x, riverMid.z) || 1;
  const nx = riverMid.x / rl;
  const nz = riverMid.z / rl;
  const ux = nz;
  const uz = -nx;
  const river: Vec[] = [];
  const np = mc.river.points;
  for (let i = 0; i < np; i++) {
    const s = -mc.river.halfLen + (2 * mc.river.halfLen * i) / (np - 1);
    const wob = (rand01(seed, 6, i) - 0.5) * 2 * mc.river.wobble;
    river.push({ x: riverMid.x + ux * s + nx * wob, z: riverMid.z + uz * s + nz * wob });
  }
  const bankOff = mc.river.width / 2 + 1.2;
  const riverStation = { x: riverMid.x - nx * bankOff, z: riverMid.z - nz * bankOff };

  const stations: Record<Station, Vec> = {
    ...mc.stationsInside,
    forest_edge: forestEdge,
    clearing,
    river: riverStation,
    mirror_pool: {
      x: poolC.x - (poolC.x / (Math.hypot(poolC.x, poolC.z) || 1)) * (mc.mirrorPool.radius + 1.5),
      z: poolC.z - (poolC.z / (Math.hypot(poolC.x, poolC.z) || 1)) * (mc.mirrorPool.radius + 1.5),
    },
  };

  // Trail graph.
  const wp: Record<string, Vec> = {
    cabin_center: { x: 0, z: 0 },
    yard: mc.yard,
    spring,
    ...stations,
  };
  const edges: Record<string, string[]> = {};
  const link = (a: string, b: string): void => {
    (edges[a] ??= []).push(b);
    (edges[b] ??= []).push(a);
  };
  for (const s of ["desk", "bed", "journal_table", "window", "door"]) link("cabin_center", s);
  link("door", "yard");
  const trail = (a: string, b: string, key: number): void => {
    const pa = wp[a] as Vec;
    const pb = wp[b] as Vec;
    const dx = pb.x - pa.x;
    const dz = pb.z - pa.z;
    const l = Math.hypot(dx, dz) || 1;
    const bend = (rand01(seed, 7, key) - 0.5) * 2 * mc.pathBend;
    const id = `${a}>${b}`;
    wp[id] = { x: (pa.x + pb.x) / 2 - (dz / l) * bend, z: (pa.z + pb.z) / 2 + (dx / l) * bend };
    link(a, id);
    link(id, b);
  };
  trail("yard", "forest_edge", 1);
  trail("yard", "clearing", 2);
  trail("yard", "river", 3);
  trail("yard", "mirror_pool", 4);
  trail("clearing", "spring", 5);

  // Resource nodes by zone.
  const nodes: ResourceNode[] = [];
  const counters: Partial<Record<NodeKind, number>> = {};
  const rng = rngFrom(seed, 8);
  const blocked = (p: Vec, kind: NodeKind): boolean => {
    if (Math.hypot(p.x, p.z) > mc.radius - 4) return true;
    if (Math.abs(p.x) < mc.cabin.halfW + 3 && Math.abs(p.z) < mc.cabin.halfD + 3) return true;
    if (dist(p, spring) < 2 || dist(p, poolC) < mc.mirrorPool.radius + 1.5) return true;
    for (const n of nodes) if (dist(p, n) < mc.nodeSpacing) return true;
    if (kind !== "fish_shoal" && dist(p, nearestOnPolyline(p, river)) < mc.river.width / 2 + 0.6)
      return true;
    for (const s of Object.values(stations)) if (dist(p, s) < 1) return true;
    return false;
  };
  const stationOf: Record<string, Vec> = { forest: forestEdge, clearing, river: riverStation };
  for (const [zone, z] of Object.entries(mc.zones)) {
    const st = stationOf[zone] as Vec;
    const l = Math.hypot(st.x, st.z) || 1;
    const centre = { x: st.x + (st.x / l) * z.out, z: st.z + (st.z / l) * z.out };
    for (const [kindStr, count] of Object.entries(z.counts)) {
      const kind = kindStr as NodeKind;
      const def = NODE_DEFS[kind];
      for (let i = 0; i < (count ?? 0); i++) {
        let p: Vec | null = null;
        for (let attempt = 0; attempt < 60 && !p; attempt++) {
          let cand: Vec;
          if (
            zone === "river" &&
            (kind === "reed_bed" || kind === "clay_bank" || kind === "fish_shoal")
          ) {
            const along = nearestOnPolyline(
              {
                x: st.x + (rng() - 0.5) * 2 * z.radius * 0.8,
                z: st.z + (rng() - 0.5) * 2 * z.radius * 0.8,
              },
              river,
            );
            const off = kind === "fish_shoal" ? 0 : mc.river.width / 2 + 0.8;
            cand = { x: along.x - nx * off, z: along.z - nz * off };
          } else {
            const a = rng() * Math.PI * 2;
            const r = Math.sqrt(rng()) * z.radius;
            cand = { x: centre.x + Math.sin(a) * r, z: centre.z + Math.cos(a) * r };
          }
          if (!blocked(cand, kind)) p = cand;
        }
        if (!p) continue;
        const idx = (counters[kind] = (counters[kind] ?? 0) + 1);
        nodes.push({
          id: `${kind}_${idx}`,
          kind,
          x: round2(p.x),
          z: round2(p.z),
          cap: def.cap,
          amount: 0,
          lookalike: rand01(seed, 9, nodes.length) < def.lookalikeChance,
        });
      }
    }
  }
  const wpPos = mc.woodpile;
  nodes.push({
    id: "woodpile_1",
    kind: "woodpile",
    x: wpPos.x,
    z: wpPos.z,
    cap: NODE_DEFS.woodpile.cap,
    amount: 0,
    lookalike: false,
  });

  return {
    seed,
    radius: mc.radius,
    cabin: mc.cabin,
    stations,
    hearth: mc.hearth,
    spring,
    pool: { ...poolC, radius: mc.mirrorPool.radius },
    river,
    riverWidth: mc.river.width,
    waypoints: wp,
    edges,
    nodes,
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function insideCabin(map: WorldMap, p: Vec): boolean {
  return Math.abs(p.x) <= map.cabin.halfW && Math.abs(p.z) <= map.cabin.halfD;
}
