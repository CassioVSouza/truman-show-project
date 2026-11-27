import { SCHEMA_VERSION, type Event } from "@truman/contracts";
import { describe, expect, it } from "vitest";
import {
  buildTimelineMarkers,
  computeVitalTrends,
  extractRecentActivity,
  formatDecisionCountdown,
  formatWorldChip,
  isEditableTarget,
  resolveShortcut,
} from "./hudHelpers";

const BASE_MS = Date.parse("2026-04-10T12:00:00.000Z");
const isoAt = (offsetSec: number) => new Date(BASE_MS + offsetSec * 1000).toISOString();

describe("hudHelpers", () => {
  it("formats decision countdown across live, due, demo, paused, and dead states", () => {
    expect(
      formatDecisionCountdown(
        {
          lastTickIso: isoAt(0),
          nowMs: BASE_MS + 60_000,
          feedState: "live",
          status: "running",
          alive: true,
        },
        "en",
      ),
    ).toEqual({ tone: "live", text: "Next decision ~2m" });

    expect(
      formatDecisionCountdown(
        {
          lastTickIso: isoAt(0),
          nowMs: BASE_MS + 2 * 60_000 + 35_000,
          feedState: "live",
          status: "running",
          alive: true,
        },
        "pt-BR",
      ),
    ).toEqual({ tone: "live", text: "Próxima decisão ~25s" });

    expect(
      formatDecisionCountdown(
        {
          lastTickIso: isoAt(0),
          nowMs: BASE_MS + 3 * 60_000,
          feedState: "live",
          status: "running",
          alive: true,
        },
        "en",
      ),
    ).toEqual({ tone: "due", text: "Decision due" });

    expect(
      formatDecisionCountdown(
        {
          lastTickIso: isoAt(0),
          nowMs: BASE_MS + 60_000,
          feedState: "demo",
          status: "running",
          alive: true,
        },
        "pt-BR",
      ),
    ).toEqual({ tone: "demo", text: "Ciclo 3m" });

    expect(
      formatDecisionCountdown(
        {
          lastTickIso: isoAt(0),
          nowMs: BASE_MS + 60_000,
          feedState: "live",
          status: "paused",
          alive: true,
        },
        "en",
      ),
    ).toEqual({ tone: "paused", text: "Paused" });

    expect(
      formatDecisionCountdown(
        {
          lastTickIso: isoAt(0),
          nowMs: BASE_MS + 60_000,
          feedState: "live",
          status: "dead",
          alive: false,
        },
        "en",
      ),
    ).toBeNull();
  });

  it("formats world/weather chip with appropriate icon and localized day", () => {
    const rain = formatWorldChip(
      { day: 4, timeOfDay: "day", weather: "rain", atMs: BASE_MS, coreTemp: 36.7 },
      "en",
    );
    expect(rain.icon).toBe("🌧");
    expect(rain.tone).toBe("day");
    expect(rain.text).toContain("Day 4");
    expect(rain.text).toContain("rain");
    expect(rain.text).toContain("36.7°C");

    const night = formatWorldChip(
      { day: 2, timeOfDay: "night", weather: "clear", atMs: BASE_MS },
      "pt-BR",
    );
    expect(night.icon).toBe("🌙");
    expect(night.text).toContain("Dia 2");
  });

  it("maps timeline events to color-coded markers and deduplicates close markers by priority", () => {
    const events: Event[] = [
      {
        v: SCHEMA_VERSION,
        seq: 1,
        t_start: isoAt(10),
        t_end: isoAt(20),
        actor: "resident",
        kind: "walk",
        data: {
          waypoints: [
            { x: 0, z: 0 },
            { x: 1, z: 1 },
          ],
          speed: 1.2,
        },
        log_id: 10,
      },
      {
        v: SCHEMA_VERSION,
        seq: 2,
        t_start: isoAt(10),
        t_end: isoAt(25),
        actor: "resident",
        kind: "thought",
        data: { text: "The wind feels colder near the river." },
        log_id: 11,
      },
      {
        v: SCHEMA_VERSION,
        seq: 3,
        t_start: isoAt(60),
        t_end: isoAt(70),
        actor: "resident",
        kind: "death",
        data: { cause: "hypothermia" },
        log_id: 12,
      },
      {
        v: SCHEMA_VERSION,
        seq: 4,
        t_start: isoAt(30),
        t_end: isoAt(35),
        actor: "world",
        kind: "world",
        data: { weather: "clear", time_of_day: "day" },
        log_id: 13,
      },
    ];

    const markers = buildTimelineMarkers(events, BASE_MS, BASE_MS + 100_000);
    // world event is ignored; walk + thought at 10s collapse to higher-priority thought
    expect(markers).toHaveLength(2);
    expect(markers[0]?.tone).toBe("thought");
    expect(markers[0]?.pct).toBeCloseTo(10, 1);
    expect(markers[1]?.tone).toBe("alert");
    expect(markers[1]?.pct).toBeCloseTo(60, 1);
  });

  it("computes vital trends with noise thresholds", () => {
    const prev = {
      health: 90,
      satiety: 70,
      hydration: 65,
      core_temp: 36.8,
      stamina: 80,
      sleep_pressure: 0.3,
    };
    const curr = {
      health: 90.2, // within 0.4 -> flat
      satiety: 68.5, // down
      hydration: 72, // up
      core_temp: 36.5, // down >= 0.15
      stamina: 85, // up
      sleep_pressure: 0.302, // flat
    };

    expect(computeVitalTrends(null, curr)).toEqual({
      health: "flat",
      satiety: "flat",
      hydration: "flat",
      core_temp: "flat",
      stamina: "flat",
      sleep_pressure: "flat",
    });

    expect(computeVitalTrends(prev, curr)).toEqual({
      health: "flat",
      satiety: "down",
      hydration: "up",
      core_temp: "down",
      stamina: "up",
      sleep_pressure: "flat",
    });
  });

  it("extracts up to 3 most recent meaningful activity items up to playhead", () => {
    const events: Event[] = [
      {
        v: SCHEMA_VERSION,
        seq: 1,
        t_start: isoAt(5),
        t_end: isoAt(10),
        actor: "resident",
        kind: "gather",
        data: { target: "firewood", gained: [{ item: "firewood", qty: 2 }] },
        log_id: 1,
      },
      {
        v: SCHEMA_VERSION,
        seq: 2,
        t_start: isoAt(15),
        t_end: isoAt(20),
        actor: "resident",
        kind: "thought",
        data: { text: "Wood is damp today." },
        log_id: 2,
      },
      {
        v: SCHEMA_VERSION,
        seq: 3,
        t_start: isoAt(25),
        t_end: isoAt(30),
        actor: "resident",
        kind: "consume",
        data: { kind: "drink", item: "water" },
        log_id: 3,
      },
      {
        v: SCHEMA_VERSION,
        seq: 4,
        t_start: isoAt(50),
        t_end: isoAt(55),
        actor: "resident",
        kind: "journal",
        data: { id: 1, preview: "Quiet afternoon by the hearth." },
        log_id: 4,
      },
    ];

    const recent = extractRecentActivity(events, BASE_MS + 30_000, 3);
    expect(recent).toHaveLength(3);
    expect(recent.map((r) => r.seq)).toEqual([3, 2, 1]);
    expect(recent[0]?.label).toBe("drink: water");
    expect(recent[1]?.tone).toBe("thought");
  });

  it("resolves keyboard shortcuts and guards editable inputs", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "textarea" })).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isEditableTarget({ tagName: "BUTTON" })).toBe(false);

    expect(resolveShortcut({ key: "1" })).toBe("camera-follow");
    expect(resolveShortcut({ key: "2" })).toBe("camera-cabin");
    expect(resolveShortcut({ key: "3" })).toBe("camera-world");
    expect(resolveShortcut({ key: " " })).toBe("toggle-play");
    expect(resolveShortcut({ key: "h" })).toBe("toggle-cinema");
    expect(resolveShortcut({ key: "H" })).toBe("toggle-cinema");
    expect(resolveShortcut({ key: "/" })).toBe("search");
    expect(resolveShortcut({ key: "k", ctrlKey: true })).toBe("search");
    expect(resolveShortcut({ key: "k", metaKey: true })).toBe("search");
    expect(resolveShortcut({ key: "Escape", target: { tagName: "INPUT" } })).toBe("escape");

    // Ignored when typing inside inputs (except Escape and Ctrl/Cmd+K)
    expect(resolveShortcut({ key: "1", target: { tagName: "INPUT" } })).toBeNull();
    expect(resolveShortcut({ key: " ", target: { tagName: "TEXTAREA" } })).toBeNull();
    expect(resolveShortcut({ key: "h", target: { tagName: "INPUT" } })).toBeNull();
    expect(resolveShortcut({ key: "/", target: { tagName: "INPUT" } })).toBeNull();
    expect(resolveShortcut({ key: "k", metaKey: true, target: { tagName: "INPUT" } })).toBe(
      "search",
    );
  });
});
