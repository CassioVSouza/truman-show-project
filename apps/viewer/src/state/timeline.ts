import type { Event, Physiology, Snapshot, Station } from "@truman/contracts";

export const TIMELINE_SAMPLE_MS = 250;

export type CharacterPoseAnim =
  "idle" | "walk" | "sleep" | "desk" | "tend_fire" | "gather" | "consume" | "dead";

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export interface FireVisualState {
  id: string;
  state: "lit" | "burning" | "dying" | "out";
  x: number;
  z: number;
}

export interface TimelineState {
  atMs: number;
  windowStartMs: number;
  windowEndMs: number;
  pose: { x: number; z: number; heading: number };
  walk: {
    waypoints: Extract<Event, { kind: "walk" }>["data"]["waypoints"];
    startMs: number;
    endMs: number;
  } | null;
  station: Station | null;
  poseAnim: CharacterPoseAnim;
  restPlacement: { onBed?: boolean; heading?: number } | null;
  midAction: boolean;
  activeActionLabel: string;
  activeEventSeq: number | null;
  thought: string | null;
  thinking: boolean;
  thoughtLogId: number | null;
  physiology: Physiology;
  weather: string;
  timeOfDay: TimeOfDay;
  fires: FireVisualState[];
  alive: boolean;
  causeOfDeath: string | null;
  status: string;
}

function parseMs(iso: string): number {
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
}

export function interpolateWaypoints(
  waypoints: Array<{ x: number; z: number }>,
  progress: number,
): { x: number; z: number; heading: number } {
  const clamped = Math.max(0, Math.min(1, progress));
  if (waypoints.length === 0) return { x: 0, z: 0, heading: 0 };
  if (waypoints.length === 1) {
    const p = waypoints[0]!;
    return { x: p.x, z: p.z, heading: 0 };
  }

  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    segLens.push(len);
    totalLen += len;
  }

  if (totalLen <= 1e-6) {
    const last = waypoints[waypoints.length - 1]!;
    return { x: last.x, z: last.z, heading: 0 };
  }

  const targetDist = clamped * totalLen;
  let accum = 0;
  for (let i = 0; i < segLens.length; i++) {
    const segLen = segLens[i]!;
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
    if (accum + segLen >= targetDist || i === segLens.length - 1) {
      const localT = segLen > 1e-6 ? Math.max(0, Math.min(1, (targetDist - accum) / segLen)) : 1;
      const x = a.x + (b.x - a.x) * localT;
      const z = a.z + (b.z - a.z) * localT;
      const heading = Math.atan2(b.x - a.x, b.z - a.z);
      return { x, z, heading };
    }
    accum += segLen;
  }

  const last = waypoints[waypoints.length - 1]!;
  return { x: last.x, z: last.z, heading: 0 };
}

function mapAnimNameToPose(name: string, station: Station | null): CharacterPoseAnim {
  const n = name.toLowerCase();
  if (n.includes("dead") || n.includes("memorial")) return "dead";
  if (n.includes("sleep") || n.includes("rest") || n.includes("lie")) return "sleep";
  if (n.includes("fire") || n.includes("cook") || n.includes("boil") || n.includes("hearth")) {
    return "tend_fire";
  }
  if (
    n.includes("desk") ||
    n.includes("type") ||
    n.includes("terminal") ||
    n.includes("read") ||
    n.includes("write") ||
    n.includes("journal")
  ) {
    return "desk";
  }
  if (n.includes("gather") || n.includes("chop") || n.includes("fish") || n.includes("repair")) {
    return "gather";
  }
  if (n.includes("eat") || n.includes("drink") || n.includes("consume")) return "consume";
  if (n.includes("walk")) return "walk";
  if (station === "bed") return "sleep";
  if (station === "desk" || station === "journal_table") return "desk";
  return "idle";
}

export function getTimelineBounds(
  snapshot: Snapshot,
  events: readonly Event[],
): { startMs: number; endMs: number } {
  const snapMs = parseMs(snapshot.generated_at);
  if (events.length === 0) {
    return { startMs: snapMs, endMs: snapMs + 60_000 };
  }
  let startMs = Infinity;
  let endMs = -Infinity;
  for (const ev of events) {
    const s = parseMs(ev.t_start);
    const e = parseMs(ev.t_end);
    if (s < startMs) startMs = s;
    if (e > endMs) endMs = e;
  }
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { startMs: snapMs, endMs: snapMs + 60_000 };
  }
  return { startMs, endMs };
}

/**
 * Pure renderer state function: evaluates snapshot + timeline events at timestamp `atMs`.
 * Supports smooth walk interpolation, mid-action state for late arrivals, body channels,
 * weather/day-night transitions, and death/memorial state.
 */
export function evaluateTimeline(
  snapshot: Snapshot,
  events: readonly Event[],
  atMs: number,
): TimelineState {
  const { startMs: windowStartMs, endMs: windowEndMs } = getTimelineBounds(snapshot, events);
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const snapshotMs = parseMs(snapshot.generated_at);

  let pose = { ...snapshot.resident.pose };
  let walk: TimelineState["walk"] = null;
  let station: Station | null = snapshot.resident.station;
  let poseAnim: CharacterPoseAnim = snapshot.resident.vitals.alive ? "idle" : "dead";
  let restPlacement: TimelineState["restPlacement"] = null;
  let midAction = false;
  let activeActionLabel = snapshot.resident.vitals.alive ? "idle" : "deceased";
  let activeEventSeq: number | null = null;
  let thought: string | null = null;
  let thinking = false;
  let thoughtLogId: number | null = null;
  let physiology: Physiology = { ...snapshot.resident.body };
  let weather = snapshot.world.weather;
  let timeOfDay: TimeOfDay = snapshot.world.time_of_day ?? "day";
  const fires = new Map<string, FireVisualState>();
  for (const entity of snapshot.world.entities) {
    if (entity.type !== "fire") continue;
    const { id, x, z, appearance } = entity;
    const state = (appearance as { state?: unknown } | null)?.state;
    fires.set(id, {
      id,
      x,
      z,
      state: state === "lit" || state === "burning" || state === "dying" ? state : "out",
    });
  }
  let alive = snapshot.resident.vitals.alive;
  let causeOfDeath = snapshot.resident.vitals.cause_of_death;
  let status = snapshot.status;
  let asleep = false;

  for (const ev of sorted) {
    const tStart = parseMs(ev.t_start);
    const tEnd = Math.max(tStart, parseMs(ev.t_end));
    if (tStart > atMs) continue;

    const isActive = atMs >= tStart && atMs <= tEnd;

    switch (ev.kind) {
      case "walk": {
        const dur = Math.max(1, tEnd - tStart);
        if (isActive || atMs < snapshotMs || tEnd > snapshotMs) {
          const progress = isActive ? (atMs - tStart) / dur : 1;
          pose = interpolateWaypoints(ev.data.waypoints, progress);
          walk = isActive ? { waypoints: ev.data.waypoints, startMs: tStart, endMs: tEnd } : null;
        }
        if (isActive) {
          poseAnim = "walk";
          midAction = true;
          activeActionLabel = "walking";
          activeEventSeq = ev.seq;
        }
        break;
      }
      case "anim": {
        if (ev.data.name === "thinking") {
          thinking = isActive;
          thoughtLogId = isActive ? ev.log_id : null;
          break;
        }
        if (ev.data.station && (isActive || atMs < snapshotMs || tEnd > snapshotMs)) {
          station = ev.data.station;
        }
        if (isActive) {
          poseAnim = mapAnimNameToPose(ev.data.name, station);
          if (poseAnim === "sleep") {
            restPlacement = { onBed: ev.data.on_bed, heading: ev.data.heading };
          }
          midAction = true;
          activeActionLabel = ev.data.name.replace(/_/g, " ");
          activeEventSeq = ev.seq;
        }
        break;
      }
      case "thought": {
        thought = ev.data.text;
        thoughtLogId = ev.log_id;
        break;
      }
      case "body": {
        physiology = {
          ...physiology,
          heart_rate: ev.data.heart_rate,
          breath_rate: ev.data.breath_rate,
          posture_openness: ev.data.posture_openness,
          heaviness: ev.data.heaviness,
          muscle_tension: ev.data.muscle_tension,
        };
        break;
      }
      case "world": {
        weather = ev.data.weather;
        timeOfDay = ev.data.time_of_day;
        break;
      }
      case "fire": {
        if (atMs >= snapshotMs && tStart < snapshotMs) break;
        const { id, state, x, z } = ev.data;
        // Older events identify a fire by position. Carry its snapshot identity when known.
        const legacyId = `fire_at_${x}_${z}`;
        if (id) fires.delete(legacyId);
        const key =
          id ?? [...fires.values()].find((fire) => fire.x === x && fire.z === z)?.id ?? legacyId;
        fires.set(key, { id: key, state, x, z });
        break;
      }
      case "sleep_start": {
        asleep = tEnd === tStart || atMs < tEnd;
        if (asleep) restPlacement = { onBed: ev.data.on_bed, heading: ev.data.heading };
        if (isActive && asleep) {
          poseAnim = "sleep";
          midAction = true;
          activeActionLabel = "sleeping";
          activeEventSeq = ev.seq;
        }
        break;
      }
      case "sleep_end": {
        asleep = false;
        if (poseAnim !== "sleep") restPlacement = null;
        break;
      }
      case "consume": {
        if (isActive) {
          poseAnim = "consume";
          midAction = true;
          activeActionLabel = `${ev.data.kind}: ${ev.data.item}`;
          activeEventSeq = ev.seq;
        }
        break;
      }
      case "gather": {
        if (isActive) {
          poseAnim = "gather";
          midAction = true;
          activeActionLabel = `gathering ${ev.data.target}`;
          activeEventSeq = ev.seq;
        }
        break;
      }
      case "web_visit": {
        if (isActive) {
          poseAnim = "desk";
          midAction = true;
          activeActionLabel = `reading ${ev.data.title ?? ev.data.url}`;
          activeEventSeq = ev.seq;
        }
        break;
      }
      case "journal": {
        if (isActive) {
          poseAnim = "desk";
          midAction = true;
          activeActionLabel = "writing journal";
          activeEventSeq = ev.seq;
        }
        break;
      }
      case "death": {
        alive = false;
        causeOfDeath = ev.data.cause;
        status = "dead";
        poseAnim = "dead";
        midAction = false;
        activeActionLabel = `deceased (${ev.data.cause})`;
        activeEventSeq = ev.seq;
        break;
      }
      case "status": {
        status = ev.data.status;
        if (ev.data.status === "dead") {
          alive = false;
          poseAnim = "dead";
        }
        break;
      }
      default:
        break;
    }
  }

  if (!alive) {
    poseAnim = "dead";
    midAction = false;
    activeActionLabel = causeOfDeath ? `deceased (${causeOfDeath})` : "deceased";
  } else if (asleep && !midAction) {
    poseAnim = "sleep";
    activeActionLabel = "sleeping";
  }

  return {
    atMs,
    windowStartMs,
    windowEndMs,
    pose,
    walk,
    station,
    poseAnim,
    restPlacement: poseAnim === "sleep" ? restPlacement : null,
    midAction,
    activeActionLabel,
    activeEventSeq,
    thought,
    thinking,
    thoughtLogId,
    physiology,
    weather,
    timeOfDay,
    fires: [...fires.values()],
    alive,
    causeOfDeath,
    status,
  };
}
