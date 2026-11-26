export const PACKAGE = "world";
export * from "./types";
export {
  WORLD_CONFIG,
  NODE_DEFS,
  ITEM_DEFS,
  STARTER_KIT,
  STARTER_WOODPILE_LOGS,
  TARGET_WORDS,
} from "./config";
export type { WorldConfig, NodeDef, ItemDef } from "./config";
export { hash32, rand01, rngFrom, strHash } from "./rng";
export {
  abundanceRamp,
  ambientTempOutside,
  clockMinute,
  dayIndex,
  daylightAt,
  minuteOfDay,
  seasonAt,
  timeOfDay,
  weatherAt,
  yearDays,
} from "./climate";
export type { Weather, Clock } from "./climate";
export { generateMap, dist, insideCabin } from "./map";
export type { WorldMap } from "./map";
export { planWalk, walkTimeline, positionAlong } from "./path";
export type { WalkPlan } from "./path";
export {
  advanceInventory,
  describeInventory,
  describeStack,
  findItem,
  foodEffects,
  invAdd,
  invCount,
  invRemove,
  itemDef,
  starterInventory,
  wornInsulation,
} from "./items";
export type { FoodEffects } from "./items";
export { fireState } from "./fire";
export { createWorld, advance, environmentAt, shelterAt, mapOf } from "./world";
export { perceive, lookAt, occupancyGrid, bearingDeg, visibleRange } from "./perception";
export type { Perception } from "./perception";
export {
  moveTo,
  gather,
  chop,
  fish,
  drink,
  fillJar,
  useItem,
  eat,
  makeFire,
  tendFire,
  boilWater,
  cook,
  wear,
  repairShelter,
  restSpot,
} from "./actions";
export type { Actor, ActionResult, Facts } from "./actions";
