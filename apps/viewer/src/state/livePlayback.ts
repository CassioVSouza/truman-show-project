import { DEFAULT_TICK_MINUTES, type Event, type Snapshot } from "@truman/contracts";
import { getTimelineBounds, type TimelineBounds } from "./timeline";

export const SNAPSHOT_REFRESH_MS = 60_000;
const DEFAULT_TICK_MS = DEFAULT_TICK_MINUTES * 60_000;
const PUBLISH_WAIT_MS = 8_000;
const SNAPSHOT_RETRY_MS = 10_000;

export function staticRefreshDelay(nextTickAt: string | null | undefined, nowMs: number): number {
  const dueMs = Date.parse(nextTickAt ?? "") + PUBLISH_WAIT_MS;
  if (dueMs > nowMs) return Math.min(dueMs - nowMs, SNAPSHOT_REFRESH_MS);
  return nowMs < dueMs + SNAPSHOT_REFRESH_MS ? SNAPSHOT_RETRY_MS : SNAPSHOT_REFRESH_MS;
}

export function liveTimelineBounds(
  snapshot: Snapshot,
  events: readonly Event[],
  nextTickAt: string | null | undefined,
  firstAnchorAt: string | undefined,
): TimelineBounds {
  const snapshotMs = Date.parse(snapshot.generated_at);
  const eventBounds = getTimelineBounds(snapshot, events);
  const startMs = firstAnchorAt
    ? Date.parse(firstAnchorAt)
    : Math.min(eventBounds.startMs, snapshotMs);
  const nextMs = Date.parse(nextTickAt ?? "");
  const nominalEnd = nextMs > snapshotMs ? nextMs : snapshotMs + DEFAULT_TICK_MS;
  let endMs = nominalEnd;
  if (!snapshot.resident.vitals.alive || snapshot.status === "dead") {
    endMs = Math.max(eventBounds.endMs, snapshotMs);
  } else {
    // Let a known action continue through publication jitter, without putting hours of future rest on the scrubber.
    for (const event of events) {
      if (!REPLAYABLE_EVENT_KINDS.has(event.kind) || Date.parse(event.t_start) > nominalEnd)
        continue;
      endMs = Math.max(endMs, Math.min(Date.parse(event.t_end), nominalEnd + DEFAULT_TICK_MS));
    }
  }
  return { startMs, endMs: Math.max(startMs + 1_000, endMs) };
}

export interface LivePlayback {
  snapshotSeq: number;
  snapshotAt: string;
  newestEventSeq: number;
  atMs: number;
  sampledAt: number;
  endMs: number;
}

export function livePlayhead(clock: LivePlayback, localTime: number): number {
  return Math.min(clock.endMs, clock.atMs + Math.max(0, localTime - clock.sampledAt));
}

const REPLAYABLE_EVENT_KINDS = new Set<Event["kind"]>([
  "walk",
  "anim",
  "thought",
  "sleep_start",
  "sleep_end",
  "consume",
  "gather",
  "web_visit",
  "journal",
]);

export function receiveLivePlayback(
  previous: LivePlayback | null,
  snapshot: Snapshot,
  events: readonly Event[],
  bounds: TimelineBounds,
  wallTime: number,
  localTime: number,
): LivePlayback {
  if (previous?.snapshotSeq === snapshot.seq && previous.snapshotAt === snapshot.generated_at) {
    return previous;
  }

  const terminal = !snapshot.resident.vitals.alive || snapshot.status === "dead";
  let startAt = Math.min(wallTime, bounds.endMs);
  let newestEventSeq = previous?.newestEventSeq ?? 0;
  const snapshotMs = Date.parse(snapshot.generated_at);
  const previousAt = previous && !terminal ? livePlayhead(previous, localTime) : null;
  const missedTicks = previousAt !== null && snapshotMs - previousAt > DEFAULT_TICK_MS;
  if (previous && previousAt !== null) {
    const continuingAction = events.some(
      (event) =>
        event.seq <= previous.newestEventSeq &&
        REPLAYABLE_EVENT_KINDS.has(event.kind) &&
        Date.parse(event.t_start) <= previousAt &&
        Date.parse(event.t_end) > snapshotMs,
    );
    startAt =
      missedTicks || (previousAt === previous.endMs && !continuingAction)
        ? Math.max(previousAt, snapshotMs)
        : previousAt;
  }

  const replayStart = missedTicks ? Math.max(bounds.startMs, snapshotMs - 1_000) : bounds.startMs;
  for (const event of events) {
    newestEventSeq = Math.max(newestEventSeq, event.seq);
    if (!previous || terminal || event.seq <= previous.newestEventSeq) continue;
    const eventAt = Date.parse(event.t_start);
    if (eventAt >= replayStart && REPLAYABLE_EVENT_KINDS.has(event.kind)) {
      startAt = Math.min(startAt, eventAt);
    }
  }

  return {
    snapshotSeq: snapshot.seq,
    snapshotAt: snapshot.generated_at,
    newestEventSeq,
    atMs: Math.min(bounds.endMs, Math.max(bounds.startMs, startAt)),
    sampledAt: localTime,
    endMs: bounds.endMs,
  };
}
