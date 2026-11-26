import type { Event } from "@truman/contracts";
import { t, type UiLang } from "../i18n";
import type { TimelineState } from "../state/timeline";
import { clear, el, formatTime } from "./dom";

export interface TimelineBarCallbacks {
  onToggleLive: () => void;
  onTogglePlay: () => void;
  onScrub: (atMs: number) => void;
  onCycleSpeed: () => void;
}

export interface TimelineBarState {
  isLive: boolean;
  isPlaying: boolean;
  speed: number;
  events: readonly Event[];
  evaluated: TimelineState;
  lang: UiLang;
}

export function renderTimelineBar(
  container: HTMLElement,
  props: TimelineBarState,
  cb: TimelineBarCallbacks,
): void {
  clear(container);
  const { evaluated, isLive, isPlaying, speed, events, lang } = props;
  const start = evaluated.windowStartMs;
  const end = Math.max(start + 1000, evaluated.windowEndMs);
  const current = Math.max(start, Math.min(end, evaluated.atMs));
  const pct = Math.round(((current - start) / (end - start)) * 1000);

  const liveBtn = el(
    "button",
    {
      type: "button",
      class: `tl-btn${isLive ? " is-live" : ""}`,
      onClick: cb.onToggleLive,
    },
    evaluated.alive ? t(lang, "timelineLive") : t(lang, "timelineMemorialReplay"),
  );

  const playBtn = el(
    "button",
    {
      type: "button",
      class: "tl-btn",
      onClick: cb.onTogglePlay,
    },
    isPlaying ? t(lang, "timelinePause") : t(lang, "timelinePlay"),
  );

  const speedBtn = el(
    "button",
    {
      type: "button",
      class: "tl-btn tl-speed",
      title: t(lang, "timelineSpeed"),
      onClick: cb.onCycleSpeed,
    },
    `${speed}×`,
  );

  const slider = el("input", {
    type: "range",
    class: "tl-slider",
    min: "0",
    max: "1000",
    step: "1",
    value: String(pct),
    "aria-label": "Timeline scrubber",
    onInput: (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      const nextMs = start + (val / 1000) * (end - start);
      cb.onScrub(nextMs);
    },
  });

  const badge = evaluated.midAction
    ? el(
        "span",
        { class: "tl-badge" },
        `${t(lang, "timelineMidAction")}: ${evaluated.activeActionLabel}`,
      )
    : el("span", { class: "tl-badge is-idle" }, evaluated.activeActionLabel);

  const meta = el(
    "div",
    { class: "tl-meta" },
    el("span", null, formatTime(new Date(current).toISOString())),
    el("span", { class: "tl-sep" }, "·"),
    el("span", null, `${events.length} ${t(lang, "timelineEventsCount")}`),
  );

  container.appendChild(
    el(
      "div",
      { class: "timeline-bar-inner" },
      el("div", { class: "tl-controls" }, liveBtn, playBtn, speedBtn),
      el("div", { class: "tl-track-wrap" }, slider),
      el("div", { class: "tl-right" }, badge, meta),
    ),
  );
}
