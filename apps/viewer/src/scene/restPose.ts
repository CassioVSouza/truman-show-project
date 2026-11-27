import { dist, insideCabin, type WorldMap } from "@truman/world";
import type { TimelineState } from "../state/timeline";

export function restPose(
  map: WorldMap,
  { pose, station, restPlacement }: Pick<TimelineState, "pose" | "station" | "restPlacement">,
): TimelineState["pose"] & { onBed: boolean } {
  const bed = map.stations.bed;
  const onBed =
    insideCabin(map, pose) &&
    (restPlacement?.onBed ?? (station === "bed" && dist(pose, bed) <= 1.5));
  return onBed
    ? { ...bed, heading: 0, onBed }
    : { ...pose, heading: restPlacement?.heading ?? pose.heading, onBed };
}
