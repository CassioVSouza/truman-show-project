import type { Event } from "@truman/contracts";
import { t, type UiLang } from "../i18n";
import type { TimelineState } from "../state/timeline";
import { el, formatTime } from "./dom";
import { buildTimelineMarkers } from "./hudHelpers";

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

export class TimelineBar {
  private readonly liveBtn: HTMLButtonElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly speedBtn: HTMLButtonElement;
  private readonly slider: HTMLInputElement;
  private readonly markersLayer = el("div", { class: "tl-markers" });
  private readonly badge = el("span", { class: "tl-badge" });
  private readonly time = el("span");
  private readonly count = el("span");
  private start = 0;
  private end = 1_000;
  private events: readonly Event[] = [];
  private markerLang: UiLang | null = null;
  private markerIdentity = "";
  private visibleEventCount = 0;

  constructor(
    container: HTMLElement,
    private readonly callbacks: TimelineBarCallbacks,
  ) {
    this.liveBtn = el("button", {
      type: "button",
      class: "tl-btn",
      onClick: callbacks.onToggleLive,
    });
    this.playBtn = el("button", {
      type: "button",
      class: "tl-btn",
      onClick: callbacks.onTogglePlay,
    });
    this.speedBtn = el("button", {
      type: "button",
      class: "tl-btn tl-speed tabular-num",
      onClick: callbacks.onCycleSpeed,
    });
    this.slider = el("input", {
      type: "range",
      class: "tl-slider",
      min: "0",
      max: "1000",
      step: "1",
      value: "0",
      onInput: () =>
        callbacks.onScrub(
          this.start + (Number(this.slider.value) / 1000) * (this.end - this.start),
        ),
    });
    container.append(
      el(
        "div",
        { class: "timeline-bar-inner" },
        el("div", { class: "tl-controls" }, this.liveBtn, this.playBtn, this.speedBtn),
        el("div", { class: "tl-track-wrap" }, this.markersLayer, this.slider),
        el(
          "div",
          { class: "tl-right" },
          this.badge,
          el(
            "div",
            { class: "tl-meta tabular-num" },
            this.time,
            el("span", { class: "tl-sep" }, "·"),
            this.count,
          ),
        ),
      ),
    );
  }

  update({ evaluated, isLive, isPlaying, speed, events, lang }: TimelineBarState): void {
    const start = evaluated.windowStartMs;
    const end = Math.max(start + 1_000, evaluated.windowEndMs);
    const current = Math.max(start, Math.min(end, evaluated.atMs));
    if (
      start !== this.start ||
      end !== this.end ||
      events !== this.events ||
      lang !== this.markerLang
    ) {
      this.start = start;
      this.end = end;
      this.events = events;
      this.markerLang = lang;
      const visible = events.filter(
        (event) => Date.parse(event.t_start) <= end && Date.parse(event.t_end) >= start,
      );
      this.visibleEventCount = visible.length;
      this.updateMarkers(visible, lang);
    }

    const sliderValue = String(Math.round(((current - start) / (end - start)) * 1000));
    if (this.slider.value !== sliderValue) this.slider.value = sliderValue;
    this.slider.setAttribute("aria-label", t(lang, "timelineScrubber"));
    this.liveBtn.classList.toggle("is-live", isLive);
    this.liveBtn.textContent = t(lang, evaluated.alive ? "timelineLive" : "timelineMemorialReplay");
    this.playBtn.textContent = t(lang, isPlaying ? "timelinePause" : "timelinePlay");
    this.speedBtn.title = t(lang, "timelineSpeed");
    this.speedBtn.textContent = `${speed}×`;
    this.badge.classList.toggle("is-idle", !evaluated.midAction);
    this.badge.textContent = evaluated.midAction
      ? `${t(lang, "timelineMidAction")}: ${evaluated.activeActionLabel}`
      : evaluated.activeActionLabel;
    this.time.textContent = formatTime(new Date(current).toISOString());
    this.count.textContent = `${this.visibleEventCount} ${t(lang, "timelineEventsCount")}`;
  }

  private updateMarkers(events: readonly Event[], lang: UiLang): void {
    const markers = buildTimelineMarkers(events, this.start, this.end);
    const identity = JSON.stringify([lang, markers]);
    if (identity === this.markerIdentity) return;
    this.markerIdentity = identity;
    this.markersLayer.replaceChildren(
      ...markers.map((marker) => {
        const label =
          marker.kind === "anim" && marker.tone === "thought"
            ? t(lang, "timelineThinking")
            : marker.label;
        const tooltip = `${marker.timeText} · ${label}`;
        return el("button", {
          type: "button",
          class: `tl-marker tone-${marker.tone}`,
          style: `left: ${marker.pct.toFixed(2)}%`,
          title: tooltip,
          "aria-label": tooltip,
          dataset: { tooltip },
          onClick: () => this.callbacks.onScrub(marker.atMs),
        });
      }),
    );
  }
}
