import { DEFAULT_TICK_MINUTES, type Event, type Snapshot } from "@truman/contracts";
import { t, type UiLang } from "../i18n";
import type { TimeOfDay } from "../state/timeline";
import { formatTime } from "./dom";

export const DECISION_CADENCE_MS = DEFAULT_TICK_MINUTES * 60_000;

export interface CountdownInput {
  lastTickIso: string | null;
  nextDecisionIso?: string | null;
  nowMs: number;
  feedState: string;
  status: string | undefined;
  alive: boolean;
  cadenceMs?: number;
}

export interface CountdownBadge {
  tone: "live" | "due" | "demo" | "paused";
  text: string;
}

export function formatDecisionCountdown(
  input: CountdownInput,
  lang: UiLang,
): CountdownBadge | null {
  if (!input.alive || input.status === "dead") return null;
  if (input.status === "paused" || input.status === "hibernating") {
    return { tone: "paused", text: t(lang, "nextDecisionPaused") };
  }
  if (input.feedState === "demo") {
    return { tone: "demo", text: t(lang, "nextDecisionCadence") };
  }
  const scheduled = input.nextDecisionIso !== undefined;
  const cadence = input.cadenceMs ?? DECISION_CADENCE_MS;
  const lastMs = Date.parse(input.lastTickIso ?? "");
  const remaining = scheduled
    ? Date.parse(input.nextDecisionIso ?? "") - input.nowMs
    : cadence - Math.max(0, input.nowMs - lastMs);
  if (!Number.isFinite(remaining)) {
    return {
      tone: "demo",
      text: t(lang, scheduled ? "nextDecisionUnknown" : "nextDecisionCadence"),
    };
  }
  if (remaining <= 0) {
    return { tone: "due", text: t(lang, scheduled ? "nextDecisionWaiting" : "nextDecisionDue") };
  }
  if (remaining < 60_000) {
    const secs = Math.max(1, Math.ceil(remaining / 1000));
    return { tone: "live", text: `${t(lang, "nextDecisionIn")} ~${secs}s` };
  }
  const mins = Math.ceil(remaining / 60_000);
  return { tone: "live", text: `${t(lang, "nextDecisionIn")} ~${mins}m` };
}

export interface WorldChipInput {
  day: number | null;
  timeOfDay: TimeOfDay;
  weather: string;
  atMs: number;
  coreTemp?: number | null;
}

export interface WorldChipData {
  icon: string;
  tone: TimeOfDay;
  text: string;
}

export function formatWorldChip(input: WorldChipInput, lang: UiLang): WorldChipData {
  const w = input.weather.toLowerCase();
  let icon: string;
  if (w.includes("storm") || w.includes("thunder")) {
    icon = "⛈";
  } else if (w.includes("rain") || w.includes("drizzle")) {
    icon = "🌧";
  } else if (w.includes("snow") || w.includes("sleet")) {
    icon = "❄";
  } else if (w.includes("fog") || w.includes("mist")) {
    icon = "🌫";
  } else if (w.includes("cloud") || w.includes("overcast")) {
    icon = "☁";
  } else if (input.timeOfDay === "night") {
    icon = "🌙";
  } else if (input.timeOfDay === "dawn") {
    icon = "🌅";
  } else if (input.timeOfDay === "dusk") {
    icon = "🌇";
  } else {
    icon = "☀";
  }

  const parts: string[] = [];
  if (input.day != null) parts.push(`${t(lang, "dayLabel")} ${input.day}`);
  parts.push(formatTime(new Date(input.atMs).toISOString()).slice(0, 5));
  if (input.weather) parts.push(input.weather);
  if (input.coreTemp != null && Number.isFinite(input.coreTemp)) {
    parts.push(`${input.coreTemp.toFixed(1)}°C`);
  }

  return {
    icon,
    tone: input.timeOfDay,
    text: parts.join(" · "),
  };
}

export type MarkerTone = "thought" | "action" | "alert" | "other";

export function truncate(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

export function describeEvent(ev: Event): { tone: MarkerTone; label: string } | null {
  switch (ev.kind) {
    case "thought":
      return { tone: "thought", label: truncate(ev.data.text, 52) };
    case "journal":
      return {
        tone: "thought",
        label: ev.data.preview ? truncate(ev.data.preview, 52) : "Journal entry",
      };
    case "death":
      return { tone: "alert", label: `Deceased: ${ev.data.cause}` };
    case "walk":
      return { tone: "action", label: "Walked" };
    case "anim":
      if (ev.data.name === "thinking") return null;
      return { tone: "action", label: ev.data.name.replace(/_/g, " ") };
    case "consume":
      return { tone: "action", label: `${ev.data.kind}: ${ev.data.item.replace(/_/g, " ")}` };
    case "gather":
      return { tone: "action", label: `Gather ${ev.data.target.replace(/_/g, " ")}` };
    case "web_visit":
      return { tone: "action", label: `Read ${truncate(ev.data.title ?? ev.data.url, 36)}` };
    case "sleep_start":
      return { tone: "action", label: "Fell asleep" };
    case "sleep_end":
      return { tone: "action", label: "Woke up" };
    case "fire":
      return { tone: "other", label: `Fire: ${ev.data.state}` };
    case "status":
      return ev.data.status === "dead"
        ? { tone: "alert", label: "Status: dead" }
        : { tone: "other", label: `Status: ${ev.data.status}` };
    case "body":
    case "world":
    default:
      return null;
  }
}

export type VitalTrend = "up" | "down" | "flat";

export interface VitalTrends {
  health: VitalTrend;
  satiety: VitalTrend;
  hydration: VitalTrend;
  core_temp: VitalTrend;
  stamina: VitalTrend;
  sleep_pressure: VitalTrend;
}

export type VitalsSnapshot = Pick<
  Snapshot["resident"]["vitals"],
  "health" | "satiety" | "hydration" | "core_temp" | "stamina" | "sleep_pressure"
>;

function diffTrend(prev: number, curr: number, threshold: number): VitalTrend {
  const delta = curr - prev;
  if (delta >= threshold) return "up";
  if (delta <= -threshold) return "down";
  return "flat";
}

export const FLAT_VITAL_TRENDS: VitalTrends = {
  health: "flat",
  satiety: "flat",
  hydration: "flat",
  core_temp: "flat",
  stamina: "flat",
  sleep_pressure: "flat",
};

export function computeVitalTrends(prev: VitalsSnapshot | null, curr: VitalsSnapshot): VitalTrends {
  if (!prev) return FLAT_VITAL_TRENDS;
  return {
    health: diffTrend(prev.health, curr.health, 0.4),
    satiety: diffTrend(prev.satiety, curr.satiety, 0.4),
    hydration: diffTrend(prev.hydration, curr.hydration, 0.4),
    core_temp: diffTrend(prev.core_temp, curr.core_temp, 0.15),
    stamina: diffTrend(prev.stamina, curr.stamina, 0.4),
    sleep_pressure: diffTrend(prev.sleep_pressure, curr.sleep_pressure, 0.008),
  };
}

export interface RecentActivityItem {
  seq: number;
  atMs: number;
  timeText: string;
  tone: MarkerTone;
  label: string;
  logId: number | null;
}

export function extractRecentActivity(
  events: readonly Event[],
  atMs: number,
  maxItems = 3,
): RecentActivityItem[] {
  const sorted = [...events].sort((a, b) => b.seq - a.seq);
  const items: RecentActivityItem[] = [];

  for (const ev of sorted) {
    if (items.length >= maxItems) break;
    const tStart = Date.parse(ev.t_start);
    if (!Number.isFinite(tStart) || tStart > atMs) continue;
    const desc = describeEvent(ev);
    if (!desc || desc.tone === "other") continue;
    const prev = items[items.length - 1];
    if (prev && prev.label === desc.label && prev.tone === desc.tone) continue;
    items.push({
      seq: ev.seq,
      atMs: tStart,
      timeText: formatTime(ev.t_start).slice(0, 5),
      tone: desc.tone,
      label: desc.label,
      logId: ev.log_id ?? null,
    });
  }

  return items;
}

export type ShortcutAction =
  "escape" | "search" | "camera-follow" | "camera-cabin" | "camera-world" | "toggle-cinema";

export interface ShortcutKeyEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: { tagName?: string; isContentEditable?: boolean } | null;
}

export function isEditableTarget(
  target: { tagName?: string; isContentEditable?: boolean } | null | undefined,
): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function resolveShortcut(e: ShortcutKeyEvent): ShortcutAction | null {
  if (e.key === "Escape") return "escape";
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") return "search";
  if (isEditableTarget(e.target)) return null;
  if (e.ctrlKey || e.metaKey || e.altKey) return null;

  switch (e.key) {
    case "/":
      return "search";
    case "1":
      return "camera-follow";
    case "2":
      return "camera-cabin";
    case "3":
      return "camera-world";
    case "h":
    case "H":
      return "toggle-cinema";
    default:
      return null;
  }
}
