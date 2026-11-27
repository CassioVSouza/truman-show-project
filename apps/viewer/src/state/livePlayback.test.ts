import { SCHEMA_VERSION, type Event } from "@truman/contracts";
import { describe, expect, it } from "vitest";
import { DEMO_SNAPSHOT } from "../api/demoData";
import {
  livePlayhead,
  liveTimelineBounds,
  receiveLivePlayback,
  staticRefreshDelay,
} from "./livePlayback";
import { evaluateTimeline } from "./timeline";

const BASE = Date.parse("2026-11-26T12:00:00.000Z");
const at = (seconds: number) => BASE + seconds * 1_000;
const iso = (seconds: number) => new Date(at(seconds)).toISOString();

function snapshot(seconds: number, seq: number) {
  return { ...DEMO_SNAPSHOT, seq, generated_at: iso(seconds) };
}

function walk(seq: number, start: number, end: number): Event {
  return {
    v: SCHEMA_VERSION,
    seq,
    actor: "resident",
    t_start: iso(start),
    t_end: iso(end),
    kind: "walk",
    data: {
      waypoints: [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
      ],
      speed: 2,
    },
    log_id: null,
  };
}

describe("live playback", () => {
  it("joins a known walk in progress", () => {
    const first = snapshot(0, 1);
    const events = [walk(1, 0, 4)];
    const bounds = liveTimelineBounds(first, events, iso(180), undefined);
    const clock = receiveLivePlayback(null, first, events, bounds, at(2), 0);
    const frame = evaluateTimeline(first, events, livePlayhead(clock, 0), bounds);

    expect(frame.poseAnim).toBe("walk");
    expect(frame.pose.x).toBe(5);
  });

  it("shows a short walk from a late snapshot and continues on an unchanged poll", () => {
    const first = snapshot(0, 1);
    const history = [walk(1, 0, 4)];
    const previous = receiveLivePlayback(
      null,
      first,
      history,
      liveTimelineBounds(first, history, iso(180), undefined),
      at(60),
      0,
    );
    expect(livePlayhead(previous, 145_000)).toBe(at(180));

    const next = snapshot(185, 2);
    const events = [...history, walk(2, 185, 189)];
    const bounds = liveTimelineBounds(next, events, iso(360), iso(0));
    const clock = receiveLivePlayback(previous, next, events, bounds, at(205), 145_000);
    const frame = evaluateTimeline(next, events, livePlayhead(clock, 147_000), bounds);
    expect(frame.poseAnim).toBe("walk");
    expect(frame.pose.x).toBe(5);
    expect(receiveLivePlayback(clock, next, events, bounds, at(207), 147_000)).toBe(clock);
  });

  it("continues a known action through publication delay at the next tick", () => {
    const first = snapshot(0, 1);
    const events = [walk(1, 165, 205)];
    const previous = receiveLivePlayback(
      null,
      first,
      events,
      liveTimelineBounds(first, events, iso(180), undefined),
      at(160),
      0,
    );
    const next = snapshot(185, 2);
    const bounds = liveTimelineBounds(next, events, iso(360), iso(0));
    const clock = receiveLivePlayback(previous, next, events, bounds, at(195), 35_000);

    expect(livePlayhead(previous, 35_000)).toBe(at(195));
    expect(livePlayhead(clock, 35_000)).toBe(at(195));
    expect(livePlayhead(clock, 36_000)).toBe(at(196));
  });

  it("resumes at the newest tick after missing several ticks", () => {
    const first = snapshot(0, 1);
    const previous = receiveLivePlayback(
      null,
      first,
      [],
      liveTimelineBounds(first, [], iso(180), undefined),
      at(0),
      0,
    );
    const next = snapshot(600, 4);
    const events = [walk(2, 400, 405), walk(3, 600, 604)];
    const bounds = liveTimelineBounds(next, events, iso(780), iso(0));
    const clock = receiveLivePlayback(previous, next, events, bounds, at(620), 620_000);

    expect(livePlayhead(clock, 620_000)).toBe(at(600));
  });

  it("bounds future continuation in the scrubber and polls around the next tick", () => {
    const first = snapshot(0, 1);
    const longAction = walk(1, 10, 2_000);
    expect(liveTimelineBounds(first, [longAction], iso(180), undefined)).toEqual({
      startMs: at(0),
      endMs: at(360),
    });
    expect(staticRefreshDelay(iso(180), at(175))).toBe(13_000);
    expect(staticRefreshDelay(iso(180), at(190))).toBe(10_000);
    expect(staticRefreshDelay(iso(180), at(250))).toBe(60_000);
    expect(staticRefreshDelay(undefined, at(0))).toBe(60_000);
  });
});
