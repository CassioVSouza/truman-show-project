// All tunable numbers of the world live here. Tune rates; never inject story.
import type { NodeKind, Season, WeatherKind } from "./types";

type PerSeason = Record<Season, number>;
const ps = (spring: number, summer: number, autumn: number, winter: number): PerSeason => ({
  spring,
  summer,
  autumn,
  winter,
});

export interface NodeDef {
  item: string; // item id yielded
  lookalikeItem?: string; // yielded when node.lookalike
  lookalikeChance: number; // per-node chance to be a look-alike at generation
  cap: number;
  regrow: number; // logistic rate per hour
  seasonCap: PerSeason; // capacity multiplier per season
  seasonRegrow: PerSeason;
  yieldPerMin: number; // units per minute at neutral skill
  skill: string;
  needsTool?: string; // item id that must be carried
  rainRegrow: number; // extra regrowth fraction while raining
}

const DEF = (
  d: Partial<NodeDef> & Pick<NodeDef, "item" | "cap" | "yieldPerMin" | "skill">,
): NodeDef => ({
  lookalikeChance: 0,
  regrow: 0,
  seasonCap: ps(1, 1, 1, 1),
  seasonRegrow: ps(1, 1, 1, 1),
  rainRegrow: 0.2,
  ...d,
});

export interface ItemDef {
  noun: string; // singular, plain words
  plural: string;
  kind: "food" | "tool" | "material" | "container" | "clothing" | "medical";
  words: string[]; // lowercase keywords the Resident may use
  satiety?: number;
  reserve?: number;
  hydration?: number;
  toxicity?: number; // illness chance when eaten fresh
  spoilPerHour?: number; // condition lost per hour at neutral temperature
  nutrient?: "carb" | "protein" | "fat" | "veg" | "sugar";
  insulation?: number; // 0..1 when worn
  fuelMinutes?: number; // burn time when added to a fire
  cooksTo?: string;
  medicinal?: boolean;
}

export const WORLD_CONFIG = {
  // ---- time & seasons ----
  seasonDays: 14, // SEASON_DAYS
  genesisYearDays: 10, // year position at genesis (late spring)
  genesisClockMinute: 390, // default minute-of-day at genesis (06:30)
  // ---- gentle start ----
  ramp: { days: 14, start: 1.5 },
  // ---- temperature (deg C) ----
  temp: {
    mean: 10,
    annualAmp: 14,
    dailyAmp: 5,
    warmestHour: 15,
    dayNoise: 2.5,
    weatherOffset: { clear: 0, cloudy: -1, fog: -1.5, rain: -3, snow: -2 } as Record<
      WeatherKind,
      number
    >,
    snowBelow: 1.5,
    cabinMean: 13,
    cabinBuffer: 0.45, // fraction of the gap to cabinMean that the walls remove
  },
  daylight: { meanHours: 12, ampHours: 3.5, twilightMinutes: 50, moon: 0.08 },
  weather: {
    blockHours: 6,
    rain: ps(0.28, 0.14, 0.34, 0.2),
    fog: ps(0.08, 0.04, 0.1, 0.1),
    cloudy: ps(0.25, 0.18, 0.28, 0.3),
    fogUntilHour: 10,
    wind: ps(0.35, 0.25, 0.4, 0.45),
    cloudCover: { clear: 0.1, cloudy: 0.6, fog: 0.5, rain: 0.9, snow: 0.9 } as Record<
      WeatherKind,
      number
    >,
  },
  // ---- map ----
  map: {
    radius: 150,
    cabin: { halfW: 2.6, halfD: 2.1 },
    stationsInside: {
      desk: { x: -1.7, z: -1.3 },
      bed: { x: 1.7, z: -1.3 },
      journal_table: { x: -1.7, z: 0.6 },
      window: { x: 0, z: -1.9 },
      door: { x: 0, z: 1.8 },
    },
    hearth: { x: 2.0, z: 0.7 },
    woodpile: { x: 2.0, z: 1.5 },
    yard: { x: 0, z: 5 },
    jitterDeg: 12,
    distJitter: 0.1,
    forestEdge: { angleDeg: 0, dist: 24 },
    clearing: { angleDeg: 90, dist: 14 },
    river: { angleDeg: 200, dist: 42, halfLen: 110, wobble: 3, width: 4, points: 12 },
    mirrorPool: { angleDeg: 290, dist: 62, radius: 5 },
    spring: { angleDeg: 120, dist: 30 },
    treeTrunkRadius: 0.6,
    nodeSpacing: 1.6,
    pathBend: 5, // max sideways bend (m) of seeded trail midpoints
    zones: {
      forest: {
        out: 8,
        radius: 20,
        counts: { tree: 26, deadwood: 8, berry_bush: 7, fruit_tree: 4, mushroom_patch: 4 },
      },
      clearing: {
        out: 0,
        radius: 11,
        counts: { root_patch: 5, herb_patch: 4, berry_bush: 2, stone_outcrop: 3, deadwood: 2 },
      },
      river: {
        out: 0,
        radius: 14,
        counts: { reed_bed: 5, clay_bank: 2, stone_outcrop: 3, fish_shoal: 1, flint_nodule: 2 },
      },
    } as Record<string, { out: number; radius: number; counts: Partial<Record<NodeKind, number>> }>,
  },
  walk: {
    speed: 1.3, // m/s
    radius: 0.4, // horizontal clearance for the Resident, including limbs
    detourPad: 0.04,
    detourMargins: [4, 12],
    cornerCount: 8,
    nodeRadii: {
      fruit_tree: 0.32,
      berry_bush: 0.7,
      stone_outcrop: 1.1,
      flint_nodule: 0.65,
      clay_bank: 1.15,
      deadwood: 0.43,
      woodpile: 0.43,
    } as Partial<Record<NodeKind, number>>,
    springRadius: 1.55,
    hearthRadius: 0.52,
    cabin: {
      wallHalfThickness: 0.09,
      doorHalfOpening: 0.51,
      furniture: {
        desk: { x: 0.575, z: 0.325 },
        bed: { x: 0.525, z: 0.825 },
        journal_table: { x: 0.425, z: 0.29 },
      },
    },
  },
  reach: 3, // metres: things you can touch
  nearRadius: 14, // metres: "nearby" for environment flags
  gatherSearchRadius: 30,
  // ---- shelter ----
  shelter: {
    cabinQuality: 0.85,
    canopyQuality: 0.35,
    canopyRadius: 4,
    restHalfLength: 0.86, // lying body, before applying walking-radius clearance
    bedReach: 1.5,
    integrityFloor: 0.25,
    integrityDecayPerHour: 0.0003,
    repairGain: 0.12,
    repairMinutes: 45,
    repairLogs: 1,
  },
  // ---- fire ----
  fire: {
    campRadius: 0.45, // radius of the outdoor fire ring
    campStandOff: 1.2, // space to work beside the fire
    campTreeClearance: 2.4,
    fuelPerLog: 60,
    kindlingLogs: 2,
    maxFuel: 600,
    dyingBelow: 20,
    litMinutes: 10,
    heatMax: 12, // deg C at the flames
    radius: 6,
    hearthRadius: 5,
    roomHeat: 6, // extra deg C for the whole cabin with the hearth burning
    adjacent: 0.9,
    stateFactor: { lit: 0.8, burning: 1, dying: 0.4, out: 0 },
    rainBurn: 2, // outdoor fire fuel burn multiplier in full rain, scaled by intensity
    pruneAfterHours: 6,
    makeMinutes: 12,
    baseSuccess: 0.35,
    skillSuccess: 0.6,
    wetPenalty: 0.6,
    tendMinutes: 5,
    tendLogs: 1,
    boilMinutes: 20,
    boilFuel: 20,
    cookMinutes: 15,
    cookFuel: 10,
  },
  // ---- resources ----
  resources: {
    seedFraction: 0.05, // regrowth floor so depleted nodes can recover
    overflowDecay: 0.03, // per hour decay toward capacity when over it
    yieldVariance: 0.2,
    skillYield: { min: 0.6, max: 1.4 },
    defaultGatherMinutes: 30,
    minGatherMinutes: 5,
    maxGatherMinutes: 180,
    maxAvoid: 0.8, // at skill 100, this fraction of look-alikes is recognised and left alone
    fishBareChance: 0.01, // per minute, no tool
    fishSkillChance: 0.0006, // extra per minute per skill point
    fishToolFactor: 6,
  },
  // ---- water ----
  water: {
    sip: 22, // hydration gained per drink action (0..100 scale)
    drinkMinutes: 3,
    jarDrinks: 6,
    riverIllness: 0.35,
    poolIllness: 0.2,
    rainIllness: 0.02,
    skillRelief: 0.4, // at skill 100, illness chance x (1 - this)
    fillMinutes: 3,
  },
  // ---- food ----
  food: {
    eatMinutes: 5,
    spoilIllnessBelow: 0.6, // condition under which spoiled food adds illness risk
    spoilIllnessMax: 0.7,
    satietyFloor: 0.5, // satiety multiplier at condition 0 (floor + (1-floor)*condition)
    spoilTempRef: 10,
    spoilTempSlope: 0.05,
    spoilTempMin: 0.2,
  },
  perception: {
    fovDeg: 140,
    baseRange: 70,
    minRange: 6,
    fogRange: 14,
    precipRangeFactor: 0.7,
    fireLitRange: 18,
    fireLightRadius: 10,
    closeSense: 2.5,
    maxLines: 9,
    cabinRange: 8,
    edgeRange: 40,
    mirrorMinLight: 0.2,
    mirrorDistance: 4,
    // where-am-I line (decision 41): radii in metres
    place: { nearCabin: 6, atWater: 3, clearing: 8, nearbyMax: 150 },
  },
  occupancy: { cell: 2, half: 40 },
};

export type WorldConfig = typeof WORLD_CONFIG;

export const NODE_DEFS: Record<NodeKind, NodeDef> = {
  berry_bush: DEF({
    item: "berries",
    lookalikeItem: "lookalike_berries",
    lookalikeChance: 0.2,
    cap: 14,
    regrow: 0.04,
    seasonCap: ps(0.6, 1, 0.8, 0),
    seasonRegrow: ps(1, 1.1, 0.7, 0),
    yieldPerMin: 0.45,
    skill: "foraging",
  }),
  fruit_tree: DEF({
    item: "fruit",
    cap: 16,
    regrow: 0.025,
    seasonCap: ps(0, 0.7, 1, 0),
    seasonRegrow: ps(0, 1, 1, 0),
    yieldPerMin: 0.4,
    skill: "foraging",
  }),
  root_patch: DEF({
    item: "roots",
    cap: 10,
    regrow: 0.02,
    seasonCap: ps(0.7, 0.9, 1, 0.6),
    seasonRegrow: ps(1, 1, 0.8, 0.3),
    yieldPerMin: 0.2,
    skill: "foraging",
    rainRegrow: 0.3,
  }),
  herb_patch: DEF({
    item: "herbs",
    cap: 8,
    regrow: 0.03,
    seasonCap: ps(1, 1, 0.7, 0.1),
    seasonRegrow: ps(1, 1, 0.6, 0.1),
    yieldPerMin: 0.3,
    skill: "foraging",
  }),
  mushroom_patch: DEF({
    item: "mushrooms",
    lookalikeItem: "toxic_mushrooms",
    lookalikeChance: 0.3,
    cap: 8,
    regrow: 0.04,
    seasonCap: ps(0.6, 0.3, 1, 0),
    seasonRegrow: ps(1, 0.5, 1.2, 0),
    yieldPerMin: 0.35,
    skill: "foraging",
    rainRegrow: 0.6,
  }),
  tree: DEF({ item: "firewood", cap: 6, regrow: 0.003, yieldPerMin: 0.06, skill: "woodcutting" }),
  deadwood: DEF({
    item: "firewood",
    cap: 5,
    regrow: 0.01,
    yieldPerMin: 0.25,
    skill: "woodcutting",
  }),
  stone_outcrop: DEF({ item: "stone", cap: 20, yieldPerMin: 0.5, skill: "foraging" }),
  flint_nodule: DEF({ item: "flint", cap: 6, yieldPerMin: 0.15, skill: "foraging" }),
  clay_bank: DEF({ item: "clay", cap: 20, regrow: 0.005, yieldPerMin: 0.3, skill: "foraging" }),
  reed_bed: DEF({
    item: "reeds",
    cap: 15,
    regrow: 0.03,
    seasonCap: ps(0.8, 1, 0.8, 0.3),
    seasonRegrow: ps(1, 1, 0.6, 0.2),
    yieldPerMin: 0.6,
    skill: "foraging",
  }),
  fish_shoal: DEF({
    item: "fish",
    cap: 8,
    regrow: 0.02,
    seasonCap: ps(0.8, 1, 0.8, 0.4),
    seasonRegrow: ps(1, 1, 0.8, 0.4),
    yieldPerMin: 0.1,
    skill: "fishing",
    needsTool: "fishing_line",
  }),
  woodpile: DEF({ item: "firewood", cap: 10, yieldPerMin: 1, skill: "woodcutting" }),
};

const FOOD = (
  noun: string,
  plural: string,
  words: string[],
  satiety: number,
  reserve: number,
  extra: Partial<ItemDef> = {},
): ItemDef => ({
  noun,
  plural,
  kind: "food",
  words,
  satiety,
  reserve,
  toxicity: 0,
  spoilPerHour: 0,
  ...extra,
});

export const ITEM_DEFS: Record<string, ItemDef> = {
  dried_food: FOOD(
    "portion of dried food",
    "portions of dried food",
    ["dried", "food", "ration", "portion", "jerky"],
    30,
    12,
    { spoilPerHour: 0.0003, nutrient: "carb" },
  ),
  fruit: FOOD("piece of fruit", "pieces of fruit", ["fruit", "apple", "pear"], 12, 3, {
    hydration: 6,
    spoilPerHour: 0.004,
    nutrient: "sugar",
  }),
  berries: FOOD("handful of berries", "handfuls of berries", ["berry", "berries"], 8, 2, {
    hydration: 4,
    spoilPerHour: 0.01,
    nutrient: "sugar",
  }),
  lookalike_berries: FOOD("handful of berries", "handfuls of berries", ["berry", "berries"], 8, 2, {
    hydration: 4,
    toxicity: 0.6,
    spoilPerHour: 0.01,
    nutrient: "sugar",
  }),
  roots: FOOD("root", "roots", ["root", "roots", "tuber"], 18, 6, {
    toxicity: 0.02,
    spoilPerHour: 0.003,
    nutrient: "carb",
    cooksTo: "cooked_roots",
  }),
  cooked_roots: FOOD(
    "cooked root",
    "cooked roots",
    ["cooked root", "cooked roots", "root", "roots"],
    26,
    9,
    { spoilPerHour: 0.008, nutrient: "carb" },
  ),
  herbs: FOOD("sprig of herbs", "sprigs of herbs", ["herb", "herbs", "leaf", "leaves"], 2, 0, {
    spoilPerHour: 0.006,
    nutrient: "veg",
    medicinal: true,
  }),
  mushrooms: FOOD("mushroom", "mushrooms", ["mushroom", "mushrooms"], 10, 3, {
    toxicity: 0.03,
    spoilPerHour: 0.012,
    nutrient: "veg",
    cooksTo: "cooked_mushrooms",
  }),
  toxic_mushrooms: FOOD("mushroom", "mushrooms", ["mushroom", "mushrooms"], 10, 3, {
    toxicity: 0.75,
    spoilPerHour: 0.012,
    nutrient: "veg",
    cooksTo: "cooked_toxic_mushrooms",
  }),
  cooked_mushrooms: FOOD(
    "cooked mushroom",
    "cooked mushrooms",
    ["cooked mushroom", "mushroom", "mushrooms"],
    12,
    4,
    { spoilPerHour: 0.015, nutrient: "veg" },
  ),
  cooked_toxic_mushrooms: FOOD(
    "cooked mushroom",
    "cooked mushrooms",
    ["cooked mushroom", "mushroom", "mushrooms"],
    12,
    4,
    { toxicity: 0.6, spoilPerHour: 0.015, nutrient: "veg" },
  ),
  fish: FOOD("fish", "fish", ["fish", "raw fish"], 22, 8, {
    toxicity: 0.25,
    spoilPerHour: 0.03,
    nutrient: "protein",
    cooksTo: "cooked_fish",
  }),
  cooked_fish: FOOD("cooked fish", "cooked fish", ["cooked fish", "fish"], 34, 14, {
    toxicity: 0.02,
    spoilPerHour: 0.015,
    nutrient: "protein",
  }),
  firewood: {
    noun: "log",
    plural: "logs",
    kind: "material",
    words: ["firewood", "wood", "log", "logs", "stick", "sticks"],
    fuelMinutes: 60,
  },
  tinder: {
    noun: "bundle of tinder",
    plural: "bundles of tinder",
    kind: "material",
    words: ["tinder", "kindling"],
  },
  flint_steel: {
    noun: "flint and steel",
    plural: "flint and steel sets",
    kind: "tool",
    words: ["flint and steel", "flint", "steel", "striker"],
  },
  knife: { noun: "knife", plural: "knives", kind: "tool", words: ["knife", "blade"] },
  cooking_pot: {
    noun: "cooking pot",
    plural: "cooking pots",
    kind: "tool",
    words: ["pot", "cooking pot"],
  },
  fishing_line: {
    noun: "fishing line",
    plural: "fishing lines",
    kind: "tool",
    words: ["fishing line", "line", "spear", "rod"],
  },
  water_jar: {
    noun: "water jar",
    plural: "water jars",
    kind: "container",
    words: ["jar", "water jar", "water", "container"],
  },
  wool_blanket: {
    noun: "wool blanket",
    plural: "wool blankets",
    kind: "clothing",
    words: ["blanket", "wool"],
    insulation: 0.35,
  },
  simple_clothing: {
    noun: "set of simple clothes",
    plural: "sets of simple clothes",
    kind: "clothing",
    words: ["clothes", "clothing", "shirt", "coat"],
    insulation: 0.3,
  },
  cloth: {
    noun: "scrap of cloth",
    plural: "scraps of cloth",
    kind: "medical",
    words: ["cloth", "scrap", "bandage", "rag"],
  },
  stone: { noun: "stone", plural: "stones", kind: "material", words: ["stone", "rock"] },
  flint: {
    noun: "flint nodule",
    plural: "flint nodules",
    kind: "material",
    words: ["flint nodule", "flint"],
  },
  clay: { noun: "lump of clay", plural: "lumps of clay", kind: "material", words: ["clay"] },
  reeds: { noun: "reed", plural: "reeds", kind: "material", words: ["reed", "reeds"] },
};

export const STARTER_KIT: { item: string; qty: number; props?: Record<string, unknown> }[] = [
  { item: "dried_food", qty: 6 },
  { item: "fruit", qty: 3 },
  { item: "water_jar", qty: 1, props: { fill: 6, quality: "clean" } },
  { item: "flint_steel", qty: 1 },
  { item: "tinder", qty: 4 },
  { item: "knife", qty: 1 },
  { item: "cooking_pot", qty: 1 },
  { item: "wool_blanket", qty: 1 },
  { item: "simple_clothing", qty: 1, props: { worn: true } },
  { item: "cloth", qty: 3 },
];

export const STARTER_WOODPILE_LOGS = 10;

/** Words the Resident uses to name a target -> node kinds (first matching entry wins). */
export const TARGET_WORDS: { kinds: NodeKind[]; words: string[] }[] = [
  { kinds: ["berry_bush"], words: ["berry", "berries", "bush"] },
  { kinds: ["fruit_tree"], words: ["fruit", "apple", "orchard"] },
  { kinds: ["root_patch"], words: ["root", "roots", "tuber", "dig"] },
  { kinds: ["herb_patch"], words: ["herb", "herbs", "leaf", "leaves", "plant"] },
  { kinds: ["mushroom_patch"], words: ["mushroom", "mushrooms", "fungus"] },
  {
    kinds: ["woodpile", "deadwood", "tree"],
    words: ["firewood", "wood", "stick", "sticks", "branch", "log", "logs"],
  },
  { kinds: ["tree"], words: ["tree", "trees", "chop", "trunk"] },
  { kinds: ["stone_outcrop"], words: ["stone", "stones", "rock", "rocks"] },
  { kinds: ["flint_nodule"], words: ["flint"] },
  { kinds: ["clay_bank"], words: ["clay"] },
  { kinds: ["reed_bed"], words: ["reed", "reeds"] },
  { kinds: ["fish_shoal"], words: ["fish", "fishing"] },
];
