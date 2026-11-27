import { fireState, fireTimeline, type Fire, type FireState, type WorldState } from "@truman/world";
import type { ViewerEvent } from "./engine";
import { isoAt, type MindState } from "./state";

export function publicFireId(fire: Fire): string {
  return fire.hearth ? "hearth_fire" : `fire_${fire.id}`;
}

function fireEvent(mind: MindState, t: number, fire: Fire, state: FireState): ViewerEvent {
  const ts = isoAt(mind, t);
  return {
    kind: "fire",
    t_start: ts,
    t_end: ts,
    data: { id: publicFireId(fire), state, x: fire.x, z: fire.z },
  };
}

/** Immediate changes from an action, including the first appearance of a campfire. */
export function changedFires(mind: MindState, after: WorldState): ViewerEvent[] {
  const before = mind.world;
  if (before.fires === after.fires) return [];
  const earlier = new Map(before.fires.map((fire) => [fire.id, fireState(fire, before.t)]));
  return after.fires.flatMap((fire) => {
    const state = fireState(fire, after.t);
    return state === earlier.get(fire.id) ? [] : [fireEvent(mind, after.t, fire, state)];
  });
}

/** Passage of world time can burn a fire down during an action or during catch-up. */
export function fireAdvanceEvents(mind: MindState, from: WorldState, until: number): ViewerEvent[] {
  return fireTimeline(from, until).map(({ t, fire, state }) => fireEvent(mind, t, fire, state));
}
