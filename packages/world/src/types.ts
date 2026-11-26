import type { InventoryItem } from "@truman/contracts";

export type Vec = { x: number; z: number };
export type Season = "spring" | "summer" | "autumn" | "winter";
export const SEASONS: readonly Season[] = ["spring", "summer", "autumn", "winter"];
export type WeatherKind = "clear" | "cloudy" | "fog" | "rain" | "snow";
export type TimeOfDay = "dawn" | "day" | "dusk" | "night";
export type Inventory = InventoryItem[];

export type NodeKind =
  | "berry_bush"
  | "fruit_tree"
  | "root_patch"
  | "herb_patch"
  | "mushroom_patch"
  | "tree"
  | "deadwood"
  | "stone_outcrop"
  | "flint_nodule"
  | "clay_bank"
  | "reed_bed"
  | "fish_shoal"
  | "woodpile";

export interface ResourceNode {
  id: string;
  kind: NodeKind;
  x: number;
  z: number;
  cap: number; // nominal capacity (units)
  amount: number; // current units, may be fractional
  lookalike: boolean; // hidden: yields the toxic look-alike item (berries, mushrooms)
}

export type FireState = "lit" | "burning" | "dying" | "out";
export interface Fire {
  id: number;
  x: number;
  z: number;
  fuel: number; // minutes of burn left
  indoors: boolean;
  litAt: number; // t of last ignition
  outAt: number | null; // t when fuel hit zero (null while burning)
  hearth: boolean; // permanent fireplace, never pruned
}

/** Everything that changes over time. The static map is derived from `seed` (see map.ts). */
export interface WorldState {
  v: 1;
  seed: number;
  t: number; // minutes since genesis
  genesisClock: number; // minute-of-day at t = 0
  cabinIntegrity: number; // 0..1
  nodes: ResourceNode[];
  fires: Fire[];
  nextFireId: number;
}

export interface Pose extends Vec {
  heading: number; // radians; 0 faces +z, forward = (sin h, cos h), right = (-cos h, sin h)
}
