import type { Event, ReplaySnapshot, SearchResponse, Snapshot } from "@truman/contracts";
import "./styles.css";
import { ViewerBeat, getViewerToken } from "./api/viewerBeat";
import { createViewerApiClient, type SnapshotFeedResult, type StatusPayload } from "./api/client";
import { stationLabel, t, type UiLang } from "./i18n";
import { WorldScene, type CameraMode } from "./scene/worldScene";
import {
  evaluateTimeline,
  getTimelineBounds,
  snapshotAt,
  TIMELINE_SAMPLE_MS,
  type TimelineBounds,
  type TimelineState,
} from "./state/timeline";
import {
  livePlayhead,
  liveTimelineBounds,
  receiveLivePlayback,
  SNAPSHOT_REFRESH_MS,
  staticRefreshDelay,
  type LivePlayback,
} from "./state/livePlayback";
import { clear, el, formatDateTime } from "./ui/dom";
import {
  computeVitalTrends,
  extractRecentActivity,
  FLAT_VITAL_TRENDS,
  formatDecisionCountdown,
  formatWorldChip,
  resolveShortcut,
  truncate,
  type VitalsSnapshot,
  type VitalTrends,
} from "./ui/hudHelpers";
import { renderLabTab, type LabTab } from "./ui/labViews";
import { renderLifeTab, type LifeTab } from "./ui/lifeViews";
import { bindTranslation, entityFallback } from "./ui/translatable";
import { openContextModal, renderSearchPalette, runSearch } from "./ui/searchAndContext";
import { renderVitalsHud } from "./ui/vitalsHud";

type Section = "life" | "lab";

class ViewerApp {
  private readonly api = createViewerApiClient();
  private lang: UiLang = "en";
  private section: Section = "life";
  private lifeTab: LifeTab = "live";
  private labTab: LabTab = "organism";
  private popupOpen = false;
  private cinemaMode = false;
  private sidebarCollapsed = false;
  private mobileHudExpanded = false;
  private recentCollapsed = false;

  private snapshot: Snapshot | null = null;
  private prevVitals: VitalsSnapshot | null = null;
  private vitalTrends: VitalTrends = FLAT_VITAL_TRENDS;
  private events: Event[] = [];
  private replaySnapshots: ReplaySnapshot[] = [];
  private timelineBounds: TimelineBounds | null = null;
  private livePlayback: LivePlayback | null = null;
  private status: StatusPayload | null = null;
  private feedState: SnapshotFeedResult["state"] | "loading" = "loading";

  private playheadMs = Date.now();
  private cameraMode: CameraMode = "follow";

  private searchOpen = false;
  private searchQuery = "";
  private searchCategory: "all" | "life" | "lab" = "all";
  private searchResponse: SearchResponse | null = null;

  private worldScene: WorldScene | null = null;
  private sceneInitialized = false;
  private renderedThought = "";
  private renderedAction = "";
  private renderedRecent = "";
  private renderedStatusChips = "";

  // Mounted containers
  private readonly root: HTMLElement;
  private topbarEl!: HTMLElement;
  private subnavEl!: HTMLElement;
  private feedBadgeEl!: HTMLElement;
  private statusStripEl!: HTMLElement;
  private feedNoticeEl!: HTMLElement;
  private searchPaletteEl!: HTMLElement;
  private mainAreaEl!: HTMLElement;
  private liveGridEl!: HTMLElement;
  private canvasHostEl!: HTMLElement;
  private thoughtOverlayEl!: HTMLElement;
  private nowDoingOverlayEl!: HTMLElement;
  private recentFeedEl!: HTMLElement;
  private cinemaExitEl!: HTMLElement;
  private hudSidebarEl!: HTMLElement;
  private tabPopupBackdropEl!: HTMLElement;
  private tabPopupPanelEl!: HTMLElement;
  private tabPopupHeaderEl!: HTMLElement;
  private tabPopupBodyEl!: HTMLElement;
  private contextModalEl!: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.mountShell();
    this.bindGlobalKeys();
    void this.refreshFeed();
    this.startPlaybackClock();
    this.startViewerBeat();
  }

  private viewersEl: HTMLElement = el("span", { class: "badge badge-viewers", role: "status" });
  private viewerCount: number | null = null;

  private startViewerBeat(): void {
    this.viewersEl.hidden = true;
    if (!this.api.apiBase) return; // demo mode: no count
    let store: Storage | null = null;
    try {
      store = window.localStorage;
    } catch {
      store = null;
    }
    const beat = new ViewerBeat({
      apiBase: this.api.apiBase,
      token: getViewerToken(store),
      isVisible: () => document.visibilityState === "visible",
      onCount: (n) => {
        this.viewerCount = n;
        this.renderViewers();
      },
    });
    beat.start();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void beat.beat();
    });
  }

  private renderViewers(): void {
    this.viewersEl.hidden = this.viewerCount === null;
    if (this.viewerCount !== null) {
      clear(this.viewersEl);
      const dot = el("span", { class: "badge-viewers-dot" });
      dot.setAttribute("aria-hidden", "true");
      this.viewersEl.append(
        dot,
        el("span", { class: "badge-viewers-count" }, String(this.viewerCount)),
        el("span", { class: "badge-viewers-label" }, t(this.lang, "viewersWatching")),
      );
    }
  }

  private bindGlobalKeys(): void {
    window.addEventListener("keydown", (e) => {
      const target = e.target as HTMLElement | null;
      const action = resolveShortcut({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        target,
      });
      if (!action) return;

      if (action === "escape") {
        if (!this.contextModalEl.hidden) {
          this.contextModalEl.hidden = true;
          clear(this.contextModalEl);
          return;
        }
        if (this.searchOpen) {
          this.closeSearchPalette();
          return;
        }
        if (this.popupOpen) {
          this.closePopup();
          return;
        }
        if (this.cinemaMode) {
          this.setCinemaMode(false);
        }
        return;
      }

      if (action === "search") {
        e.preventDefault();
        this.openSearchPalette();
        return;
      }

      // Remaining shortcuts only apply when modals/popups aren't blocking
      if (!this.contextModalEl.hidden || this.searchOpen || this.popupOpen) return;

      switch (action) {
        case "camera-follow":
          this.setCameraMode("follow");
          break;
        case "camera-cabin":
          this.setCameraMode("cabin");
          break;
        case "camera-world":
          this.setCameraMode("world");
          break;
        case "toggle-cinema":
          this.setCinemaMode(!this.cinemaMode);
          break;
      }
    });
  }

  private setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.worldScene?.setCameraMode(mode);
    this.renderChrome();
  }

  private setCinemaMode(enabled: boolean): void {
    this.cinemaMode = enabled;
    this.root.classList.toggle("is-cinema-mode", enabled);
    this.cinemaExitEl.hidden = !enabled;
    this.renderChrome();
  }

  private openSearchPalette(): void {
    this.searchOpen = true;
    this.renderSearch(true);
  }

  private closeSearchPalette(): void {
    this.searchOpen = false;
    this.renderSearch(false);
  }

  private mountShell(): void {
    clear(this.root);

    this.topbarEl = el("header", { class: "topbar" });
    this.subnavEl = el("nav", { class: "subnav-bar" });
    this.feedBadgeEl = el("span", { class: "badge", role: "status" });
    this.statusStripEl = el("div", { class: "status-strip" });
    this.feedNoticeEl = el("p", { class: "feed-notice" });

    this.searchPaletteEl = el("div", { class: "search-palette-backdrop" });
    this.searchPaletteEl.hidden = true;
    this.searchPaletteEl.addEventListener("click", (e) => {
      if (e.target === this.searchPaletteEl) {
        this.closeSearchPalette();
      }
    });

    this.canvasHostEl = el("div", { class: "canvas-host" });
    this.thoughtOverlayEl = el("div", { class: "thought-bubble" });
    this.nowDoingOverlayEl = el("div", { class: "now-doing-pill" });
    this.recentFeedEl = el("div", { class: "recent-feed" });

    this.cinemaExitEl = el(
      "button",
      {
        type: "button",
        class: "cinema-exit-btn",
        onClick: () => this.setCinemaMode(false),
      },
      `${t(this.lang, "cinemaExit")} (H)`,
    );
    this.cinemaExitEl.hidden = true;

    const stageWrap = el(
      "div",
      { class: "stage-wrap" },
      this.feedNoticeEl,
      this.canvasHostEl,
      el(
        "div",
        { class: "stage-overlay-top" },
        this.thoughtOverlayEl,
        el("div", { class: "camera-controls", id: "camera-controls" }),
      ),
      el("div", { class: "stage-overlay-bottom" }, this.recentFeedEl, this.nowDoingOverlayEl),
      this.cinemaExitEl,
    );

    this.hudSidebarEl = el("aside", { class: "hud-sidebar" });
    this.liveGridEl = el("div", { class: "live-grid" }, stageWrap, this.hudSidebarEl);

    this.tabPopupHeaderEl = el("div", { class: "tab-popup-header" });
    this.tabPopupBodyEl = el("div", { class: "tab-popup-body" });
    this.tabPopupPanelEl = el(
      "section",
      { class: "tab-popup-panel", role: "dialog" },
      this.tabPopupHeaderEl,
      this.tabPopupBodyEl,
    );
    this.tabPopupPanelEl.setAttribute("aria-labelledby", "tab-popup-title");
    this.tabPopupBackdropEl = el("div", { class: "tab-popup-backdrop" }, this.tabPopupPanelEl);
    this.tabPopupBackdropEl.hidden = true;
    this.tabPopupBackdropEl.addEventListener("click", (e) => {
      if (e.target === this.tabPopupBackdropEl) {
        this.closePopup();
      }
    });

    this.mainAreaEl = el("main", { class: "main-area" }, this.liveGridEl);
    this.contextModalEl = el("div", { class: "modal-backdrop" });
    this.contextModalEl.hidden = true;
    this.contextModalEl.addEventListener("click", (e) => {
      if (e.target === this.contextModalEl) {
        this.contextModalEl.hidden = true;
        clear(this.contextModalEl);
      }
    });

    this.root.append(
      this.topbarEl,
      this.subnavEl,
      this.mainAreaEl,
      this.tabPopupBackdropEl,
      this.searchPaletteEl,
      this.contextModalEl,
    );

    this.renderChrome();
  }

  private initScene(): void {
    this.sceneInitialized = true;
    try {
      this.worldScene = new WorldScene(this.canvasHostEl);
      this.worldScene.setCameraMode(this.cameraMode);
    } catch {
      // Fallback gracefully if WebGL is unavailable (e.g. headless environments)
      this.canvasHostEl.appendChild(
        el(
          "p",
          { class: "muted-note", style: "padding:1rem" },
          "WebGL unavailable in this browser.",
        ),
      );
    }
  }

  private async refreshFeed(): Promise<void> {
    try {
      const feed = await this.api.fetchSnapshotFeed();
      const wasDemo = this.feedState === "demo";
      const newSnapshot =
        this.snapshot?.seq !== feed.snapshot?.seq ||
        this.snapshot?.generated_at !== feed.snapshot?.generated_at ||
        wasDemo !== (feed.state === "demo");
      if (this.snapshot && feed.snapshot && feed.snapshot.seq !== this.snapshot.seq) {
        this.prevVitals = { ...this.snapshot.resident.vitals };
      }
      this.snapshot = feed.snapshot;
      if (this.snapshot) {
        this.vitalTrends = computeVitalTrends(this.prevVitals, this.snapshot.resident.vitals);
      }
      this.events = feed.events;
      this.replaySnapshots = feed.replay_snapshots ?? [];
      this.status = feed.status;
      this.feedState = feed.state;
      this.renderedStatusChips = "";
      this.renderFeedStatus();

      if (this.snapshot) {
        if (!this.sceneInitialized) this.initScene();
        if (newSnapshot)
          this.worldScene?.applyFeedGeometry(this.snapshot, this.events, this.replaySnapshots);
        const isDemo = feed.state === "demo";
        this.timelineBounds = isDemo
          ? getTimelineBounds(this.snapshot, this.events)
          : liveTimelineBounds(
              this.snapshot,
              this.events,
              this.status?.next_tick_at,
              this.replaySnapshots[0]?.generated_at,
            );
        const { startMs, endMs } = this.timelineBounds;
        const localTime = performance.now();
        this.livePlayback = isDemo
          ? null
          : receiveLivePlayback(
              this.livePlayback,
              this.snapshot,
              this.events,
              this.timelineBounds,
              Date.now(),
              localTime,
            );
        if (this.livePlayback) {
          this.playheadMs = livePlayhead(this.livePlayback, localTime);
        } else if (!wasDemo) {
          this.playheadMs = startMs + 8_000;
        }
        this.renderFrame();
      }

      // Open tabs must follow the live feed: with a static snapshot host the poll only brings new data
      // when the snapshot changes, so refresh then; with a direct API every poll refreshes.
      if (this.popupOpen && (newSnapshot || !this.api.snapshotBase)) {
        void this.renderActiveContentTab(true);
      }
    } finally {
      if (this.api.snapshotBase || this.api.apiBase) {
        const delay = this.api.snapshotBase
          ? staticRefreshDelay(this.status?.next_tick_at, Date.now())
          : SNAPSHOT_REFRESH_MS;
        window.setTimeout(() => void this.refreshFeed(), delay);
      }
    }
  }

  private startPlaybackClock(): void {
    let last = performance.now();
    window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (!this.snapshot || !this.timelineBounds) return;
      if (this.livePlayback) {
        this.playheadMs = livePlayhead(this.livePlayback, now);
      } else {
        // Demo data only: loop a sample day at real speed.
        const { startMs, endMs } = this.timelineBounds;
        this.playheadMs += dt;
        if (this.playheadMs >= endMs) this.playheadMs = startMs;
      }
      this.renderFrame();
    }, TIMELINE_SAMPLE_MS);
  }

  private renderChrome(): void {
    this.root.classList.toggle("is-lab-mode", this.section === "lab");
    this.liveGridEl.classList.toggle("is-sidebar-collapsed", this.sidebarCollapsed);
    this.cinemaExitEl.textContent = `${t(this.lang, "cinemaExit")} (H)`;

    // Topbar
    clear(this.topbarEl);

    const searchTrigger = el(
      "button",
      {
        type: "button",
        class: "search-trigger",
        title: `${t(this.lang, "searchButton")} (/)`,
        "aria-label": t(this.lang, "searchButton"),
        onClick: () => this.openSearchPalette(),
      },
      el("span", { class: "search-trigger-icon" }, "⌕"),
      el("span", { class: "search-trigger-label" }, t(this.lang, "searchButton")),
      el("kbd", { class: "kbd-hint" }, "/"),
    );

    const cinemaBtn = el(
      "button",
      {
        type: "button",
        class: `pill-btn cinema-toggle-btn${this.cinemaMode ? " is-active" : ""}`,
        title: `${t(this.lang, "cinemaEnter")} (H)`,
        onClick: () => this.setCinemaMode(!this.cinemaMode),
      },
      t(this.lang, "cinemaEnter"),
      " ",
      el("kbd", { class: "kbd-hint" }, "H"),
    );

    this.topbarEl.append(
      el(
        "div",
        { class: "brand" },
        el("span", null, t(this.lang, "appTitle")),
        this.feedBadgeEl,
        this.viewersEl,
      ),
      el(
        "div",
        { class: "section-switch", role: "tablist" },
        el(
          "button",
          {
            type: "button",
            class: `section-btn is-life${this.section === "life" ? " is-active" : ""}`,
            onClick: () => this.switchSection("life"),
          },
          t(this.lang, "sectionLife"),
        ),
        el(
          "button",
          {
            type: "button",
            class: `section-btn is-lab${this.section === "lab" ? " is-active" : ""}`,
            onClick: () => this.switchSection("lab"),
          },
          t(this.lang, "sectionLab"),
        ),
      ),
      el(
        "div",
        { class: "topbar-actions" },
        searchTrigger,
        cinemaBtn,
        el(
          "div",
          { class: "lang-switch" },
          el(
            "button",
            {
              type: "button",
              class: `pill-btn${this.lang === "en" ? " is-active" : ""}`,
              onClick: () => this.setLang("en"),
            },
            "EN",
          ),
          el(
            "button",
            {
              type: "button",
              class: `pill-btn${this.lang === "pt-BR" ? " is-active" : ""}`,
              onClick: () => this.setLang("pt-BR"),
            },
            "PT-BR",
          ),
        ),
      ),
    );

    // Sub-nav tabs
    clear(this.subnavEl);
    const tabsEl = el("div", { class: "tabs" });
    if (this.section === "life") {
      const lifeTabs: Array<[LifeTab, string]> = [
        ["live", t(this.lang, "navLive")],
        ["thoughts", t(this.lang, "navThoughts")],
        ["journal", t(this.lang, "navJournal")],
        ["actions", t(this.lang, "navActions")],
        ["memories", t(this.lang, "navMemories")],
        ["questions", t(this.lang, "navQuestionsLessons")],
        ["searches", t(this.lang, "navSearches")],
      ];
      for (const [id, label] of lifeTabs) {
        const isActive =
          id === "live"
            ? !this.popupOpen && this.section === "life"
            : this.popupOpen && this.section === "life" && this.lifeTab === id;
        tabsEl.appendChild(
          el(
            "button",
            {
              type: "button",
              class: `tab-btn${isActive ? " is-active" : ""}`,
              onClick: () => this.selectLifeTab(id),
            },
            label,
          ),
        );
      }
    } else {
      const labTabs: Array<[LabTab, string]> = [
        ["organism", t(this.lang, "navLabOrganism")],
        ["appraisals", t(this.lang, "navLabAppraisals")],
        ["traces", t(this.lang, "navLabTraces")],
        ["governor", t(this.lang, "navLabGovernor")],
        ["rawlog", t(this.lang, "navLabRawLog")],
      ];
      for (const [id, label] of labTabs) {
        const isActive = this.popupOpen && this.section === "lab" && this.labTab === id;
        tabsEl.appendChild(
          el(
            "button",
            {
              type: "button",
              class: `tab-btn${isActive ? " is-active" : ""}`,
              onClick: () => this.selectLabTab(id),
            },
            label,
          ),
        );
      }
    }

    this.subnavEl.append(tabsEl, this.statusStripEl);
    this.renderFeedStatus();
    this.renderViewers();

    // Camera buttons overlay
    const camBox = document.getElementById("camera-controls");
    if (camBox) {
      clear(camBox);
      const cams: Array<[CameraMode, string, string]> = [
        ["follow", t(this.lang, "cameraFollow"), "1"],
        ["cabin", t(this.lang, "cameraCabin"), "2"],
        ["world", t(this.lang, "cameraWorld"), "3"],
      ];
      for (const [mode, label, shortcut] of cams) {
        camBox.appendChild(
          el(
            "button",
            {
              type: "button",
              class: `pill-btn${this.cameraMode === mode ? " is-active" : ""}`,
              title: `${label} (${shortcut})`,
              onClick: () => this.setCameraMode(mode),
            },
            label,
          ),
        );
      }
    }
  }

  private renderFeedStatus(): void {
    const snapshot = this.snapshot;
    const status = this.status?.status ?? snapshot?.status;
    const isDead = snapshot?.resident.vitals.alive === false || status === "dead";
    this.feedBadgeEl.className = "badge";
    let badge = t(this.lang, "liveBadge");

    if (this.feedState === "loading") {
      badge = t(this.lang, "loading");
    } else if (this.feedState === "unavailable") {
      badge = t(this.lang, "feedUnavailableBadge");
      this.feedBadgeEl.classList.add("badge-delayed");
    } else if (isDead) {
      badge = t(this.lang, "deadBadge");
      this.feedBadgeEl.classList.add("badge-dead");
    } else if (this.feedState === "demo") {
      badge = t(this.lang, "demoBadge");
      this.feedBadgeEl.classList.add("badge-demo");
    } else if (this.feedState === "stale") {
      badge = t(this.lang, "feedDelayedBadge");
      this.feedBadgeEl.classList.add("badge-delayed");
    } else if (status === "paused" || status === "hibernating" || status === "degraded") {
      const messages = {
        paused: "statusPaused",
        hibernating: "statusHibernating",
        degraded: "statusDegraded",
      } as const;
      badge = t(this.lang, messages[status]);
    } else {
      this.feedBadgeEl.classList.add("badge-live");
    }
    if (this.feedBadgeEl.textContent !== badge) this.feedBadgeEl.textContent = badge;

    this.feedNoticeEl.hidden = !!snapshot;
    this.feedNoticeEl.textContent =
      this.feedState === "loading"
        ? t(this.lang, "loading")
        : t(this.lang, "feedUnavailableNotice");
    this.canvasHostEl.hidden = !snapshot;
    this.hudSidebarEl.hidden = !snapshot;
    this.nowDoingOverlayEl.hidden = !snapshot;
    this.recentFeedEl.hidden = !snapshot;
    if (!snapshot) {
      this.thoughtOverlayEl.style.display = "none";
      this.renderStatusChips(null);
    }
  }

  private renderStatusChips(evaluated: TimelineState | null): void {
    const snapshot = this.snapshot;
    const status = this.status?.status ?? snapshot?.status;
    const alive =
      (evaluated?.alive ?? snapshot?.resident.vitals.alive ?? true) && status !== "dead";
    const lastTickIso = this.status?.last_tick_at ?? snapshot?.generated_at ?? null;
    const countdown = formatDecisionCountdown(
      {
        lastTickIso,
        nextDecisionIso: this.status?.next_decision_at,
        nowMs: Date.now(),
        feedState: this.feedState,
        status,
        alive,
      },
      this.lang,
    );

    const day = this.status?.world_day ?? this.status?.day ?? null;
    const season = this.status?.season ?? null;
    const phase = this.status?.phase ?? snapshot?.resident.phase ?? null;
    const worldChip =
      snapshot && evaluated
        ? formatWorldChip(
            {
              day,
              timeOfDay: evaluated.timeOfDay,
              weather: evaluated.weather,
              atMs: evaluated.atMs,
              coreTemp: snapshot.resident.vitals.core_temp,
            },
            this.lang,
          )
        : null;

    const identity = JSON.stringify([
      this.lang,
      countdown,
      worldChip,
      season,
      phase,
      this.feedState === "stale" ? snapshot?.generated_at : null,
    ]);
    if (this.renderedStatusChips === identity) return;
    this.renderedStatusChips = identity;

    clear(this.statusStripEl);
    if (countdown) {
      this.statusStripEl.append(
        el(
          "span",
          { class: `status-chip countdown-chip tone-${countdown.tone} tabular-num` },
          countdown.text,
        ),
      );
    }
    if (worldChip) {
      this.statusStripEl.append(
        el(
          "span",
          { class: `status-chip world-chip tone-${worldChip.tone} tabular-num` },
          el("span", { class: "world-chip-icon" }, worldChip.icon),
          el("span", null, worldChip.text),
        ),
      );
    }
    if (season) {
      this.statusStripEl.append(el("span", null, `${t(this.lang, "seasonLabel")}: ${season}`));
    }
    if (phase) {
      this.statusStripEl.append(el("span", null, `${t(this.lang, "phaseLabel")}: ${phase}`));
    }
    if (this.feedState === "stale" && snapshot) {
      this.statusStripEl.append(
        el(
          "span",
          { class: "tabular-num" },
          `${t(this.lang, "feedLastUpdate")}: ${formatDateTime(snapshot.generated_at)}`,
        ),
      );
    }
  }

  private renderFrame(): void {
    const snapshot = this.snapshot;
    if (!snapshot || !this.timelineBounds) return;
    const baseline = !snapshot.resident.vitals.alive
      ? snapshot
      : snapshotAt(snapshot, this.replaySnapshots, this.playheadMs);
    const evaluated = evaluateTimeline(baseline, this.events, this.playheadMs, this.timelineBounds);
    this.worldScene?.applyTimelineState(evaluated, 1);

    this.renderStatusChips(evaluated);
    this.renderThought(evaluated);
    this.renderAction(evaluated);
    this.renderRecentFeed(evaluated);

    // Vitals & Body HUD
    renderVitalsHud(this.hudSidebarEl, snapshot, evaluated, this.lang, {
      collapsed: this.sidebarCollapsed,
      onToggleCollapse: () => {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        this.liveGridEl.classList.toggle("is-sidebar-collapsed", this.sidebarCollapsed);
        this.renderFrame();
      },
      trends: this.vitalTrends,
      mobileExpanded: this.mobileHudExpanded,
      onToggleMobile: () => {
        this.mobileHudExpanded = !this.mobileHudExpanded;
        this.renderFrame();
      },
    });
  }

  private renderThought(evaluated: TimelineState): void {
    const { thought, thinking, thoughtLogId } = evaluated;
    const identity = JSON.stringify([this.lang, thought, thinking, thoughtLogId]);
    if (this.renderedThought === identity) return;
    this.renderedThought = identity;
    clear(this.thoughtOverlayEl);
    this.thoughtOverlayEl.style.display = thought || thinking ? "block" : "none";
    this.thoughtOverlayEl.classList.toggle("is-clickable", thoughtLogId != null);
    this.thoughtOverlayEl.onclick = null;
    this.thoughtOverlayEl.onkeydown = null;
    this.thoughtOverlayEl.removeAttribute("role");
    this.thoughtOverlayEl.removeAttribute("tabindex");
    this.thoughtOverlayEl.removeAttribute("title");

    if (!thought && !thinking) return;

    const langTag = el("span", { class: "tag" });
    const headerRow = el(
      "div",
      { class: "thought-bubble-header" },
      el("div", { class: "thought-bubble-label" }, t(this.lang, "thoughtBubbleLabel")),
      this.lang === "en" ? null : langTag,
      thoughtLogId != null
        ? el("span", { class: "thought-bubble-cta" }, `${t(this.lang, "inspectContext")} ↗`)
        : null,
    );
    this.thoughtOverlayEl.append(headerRow);

    if (thought) {
      const text = el("p", { class: "thought-bubble-text" }, thought);
      this.thoughtOverlayEl.append(text);
      bindTranslation(
        text,
        langTag,
        thought,
        this.lang,
        null,
        thoughtLogId != null ? entityFallback(this.api, "log_entries", thoughtLogId) : undefined,
      );
    }

    if (thoughtLogId != null) {
      const openCtx = () => {
        void openContextModal(this.contextModalEl, this.api, thoughtLogId, this.lang);
      };
      this.thoughtOverlayEl.setAttribute("role", "button");
      this.thoughtOverlayEl.setAttribute("tabindex", "0");
      this.thoughtOverlayEl.setAttribute("title", t(this.lang, "thoughtInspectHint"));
      this.thoughtOverlayEl.onclick = openCtx;
      this.thoughtOverlayEl.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openCtx();
        }
      };
    }

    // Trigger subtle entrance transition on new thought
    this.thoughtOverlayEl.classList.remove("is-entering");
    void this.thoughtOverlayEl.offsetWidth;
    this.thoughtOverlayEl.classList.add("is-entering");
  }

  private renderRecentFeed(evaluated: TimelineState): void {
    const items = extractRecentActivity(this.events, evaluated.atMs, 3);
    const identity = JSON.stringify([this.lang, this.recentCollapsed, items]);
    if (this.renderedRecent === identity) return;
    this.renderedRecent = identity;

    clear(this.recentFeedEl);
    if (items.length === 0) {
      this.recentFeedEl.hidden = true;
      return;
    }
    this.recentFeedEl.hidden = false;
    this.recentFeedEl.classList.toggle("is-collapsed", this.recentCollapsed);

    const toggleBtn = el(
      "button",
      {
        type: "button",
        class: "recent-feed-toggle",
        onClick: () => {
          this.recentCollapsed = !this.recentCollapsed;
          this.renderedRecent = "";
          this.renderRecentFeed(evaluated);
        },
      },
      el("span", { class: "recent-feed-title" }, t(this.lang, "recentTitle")),
      el("span", { class: "recent-feed-chevron" }, this.recentCollapsed ? "▴" : "▾"),
    );

    this.recentFeedEl.append(toggleBtn);
    if (this.recentCollapsed) return;

    const list = el("ul", { class: "recent-feed-list" });
    for (const item of items) {
      const recentText = el("span", { class: "recent-text" }, item.label);
      if (item.tone === "thought" && item.logId != null) {
        const logId = item.logId;
        bindTranslation(recentText, null, item.label, this.lang, null, async () => {
          const full = await this.api.translateEntity("log_entries", logId);
          return full ? truncate(full, 52) : null;
        });
      }
      const content = el(
        "span",
        { class: "recent-feed-item-inner" },
        el("span", { class: `recent-dot tone-${item.tone}` }),
        el("span", { class: "recent-time tabular-num" }, item.timeText),
        recentText,
      );
      if (item.logId != null) {
        const logId = item.logId;
        list.appendChild(
          el(
            "li",
            null,
            el(
              "button",
              {
                type: "button",
                class: "recent-feed-btn",
                title: t(this.lang, "inspectContext"),
                onClick: () => {
                  void openContextModal(this.contextModalEl, this.api, logId, this.lang);
                },
              },
              content,
            ),
          ),
        );
      } else {
        list.appendChild(el("li", { class: "recent-feed-row" }, content));
      }
    }
    this.recentFeedEl.append(list);
  }

  private renderAction(evaluated: TimelineState): void {
    const { activeActionLabel, activeEventSeq, midAction, station, weather, timeOfDay } = evaluated;
    const label = `${activeActionLabel} · ${t(this.lang, "stationLabel")}: ${stationLabel(this.lang, station)} · ${t(this.lang, "weatherLabel")}: ${weather} (${timeOfDay})`;
    const logId = midAction
      ? this.events.find((event) => event.seq === activeEventSeq)?.log_id
      : null;
    const identity = JSON.stringify([this.lang, label, logId]);
    if (this.renderedAction === identity) return;
    this.renderedAction = identity;

    clear(this.nowDoingOverlayEl);
    this.nowDoingOverlayEl.append(el("strong", null, `${t(this.lang, "nowDoing")}: `), label);
    const context = this.contextButton(logId);
    if (context) this.nowDoingOverlayEl.append(" ", context);
  }

  private contextButton(id: number | null | undefined): HTMLElement | null {
    if (id == null) return null;
    return el(
      "button",
      {
        type: "button",
        class: "link-btn",
        onClick: () => {
          void openContextModal(this.contextModalEl, this.api, id, this.lang);
        },
      },
      t(this.lang, "inspectContext"),
    );
  }

  private switchSection(sec: Section): void {
    this.section = sec;
    if (sec === "life") {
      this.lifeTab = "live";
      this.popupOpen = false;
    } else {
      this.popupOpen = true;
    }
    this.updateViewVisibility();
    this.renderChrome();
    if (this.popupOpen) {
      void this.renderActiveContentTab();
    }
  }

  private selectLifeTab(tab: LifeTab): void {
    if (tab === "live") {
      this.section = "life";
      this.lifeTab = "live";
      this.popupOpen = false;
      this.updateViewVisibility();
      this.renderChrome();
      return;
    }
    if (this.popupOpen && this.section === "life" && this.lifeTab === tab) {
      this.closePopup();
      return;
    }
    this.section = "life";
    this.lifeTab = tab;
    this.popupOpen = true;
    this.updateViewVisibility();
    this.renderChrome();
    void this.renderActiveContentTab();
  }

  private selectLabTab(tab: LabTab): void {
    if (this.popupOpen && this.section === "lab" && this.labTab === tab) {
      this.closePopup();
      return;
    }
    this.section = "lab";
    this.labTab = tab;
    this.popupOpen = true;
    this.updateViewVisibility();
    this.renderChrome();
    void this.renderActiveContentTab();
  }

  private closePopup(): void {
    this.popupOpen = false;
    if (this.section === "life") {
      this.lifeTab = "live";
    }
    this.updateViewVisibility();
    this.renderChrome();
  }

  private updateViewVisibility(): void {
    const openingPopup = this.popupOpen && this.tabPopupBackdropEl.hidden;
    this.liveGridEl.hidden = false;
    this.tabPopupBackdropEl.hidden = !this.popupOpen;
    this.tabPopupPanelEl.className = `tab-popup-panel ${this.section === "lab" ? "is-lab" : "is-life"}`;
    document.body.classList.toggle("has-overlay", this.popupOpen);
    if (this.popupOpen) {
      this.renderPopupHeader();
      if (openingPopup) {
        this.tabPopupHeaderEl.querySelector<HTMLButtonElement>(".tab-popup-close")?.focus();
      }
    }
  }

  private getActivePopupTitle(): string {
    if (this.section === "life") {
      const titles: Record<Exclude<LifeTab, "live">, string> = {
        thoughts: t(this.lang, "navThoughts"),
        journal: t(this.lang, "navJournal"),
        actions: t(this.lang, "navActions"),
        memories: t(this.lang, "navMemories"),
        questions: t(this.lang, "navQuestionsLessons"),
        searches: t(this.lang, "navSearches"),
      };
      return this.lifeTab === "live" ? t(this.lang, "navLive") : titles[this.lifeTab];
    }
    const labTitles: Record<LabTab, string> = {
      organism: t(this.lang, "navLabOrganism"),
      appraisals: t(this.lang, "navLabAppraisals"),
      traces: t(this.lang, "navLabTraces"),
      governor: t(this.lang, "navLabGovernor"),
      rawlog: t(this.lang, "navLabRawLog"),
    };
    return labTitles[this.labTab];
  }

  private renderPopupHeader(): void {
    clear(this.tabPopupHeaderEl);
    const isLab = this.section === "lab";
    const sectionLabel = isLab ? t(this.lang, "sectionLab") : t(this.lang, "sectionLife");

    const titleRow = el(
      "div",
      { class: "tab-popup-title-row" },
      el(
        "div",
        { class: "tab-popup-title-group" },
        el("span", { class: `tag ${isLab ? "tag-lab" : "tag-life"}` }, sectionLabel),
        el("h2", { class: "tab-popup-title", id: "tab-popup-title" }, this.getActivePopupTitle()),
      ),
      el(
        "button",
        {
          type: "button",
          class: "tab-popup-close",
          "aria-label": t(this.lang, "close"),
          title: t(this.lang, "close"),
          onClick: () => this.closePopup(),
        },
        "×",
      ),
    );

    const switcher = el("div", { class: "tab-popup-switcher" });
    if (isLab) {
      const labTabs: Array<[LabTab, string]> = [
        ["organism", t(this.lang, "navLabOrganism")],
        ["appraisals", t(this.lang, "navLabAppraisals")],
        ["traces", t(this.lang, "navLabTraces")],
        ["governor", t(this.lang, "navLabGovernor")],
        ["rawlog", t(this.lang, "navLabRawLog")],
      ];
      for (const [id, label] of labTabs) {
        switcher.appendChild(
          el(
            "button",
            {
              type: "button",
              class: `popup-tab-pill${this.labTab === id ? " is-active" : ""}`,
              onClick: () => {
                if (this.labTab !== id) this.selectLabTab(id);
              },
            },
            label,
          ),
        );
      }
    } else {
      const lifeTabs: Array<[Exclude<LifeTab, "live">, string]> = [
        ["thoughts", t(this.lang, "navThoughts")],
        ["journal", t(this.lang, "navJournal")],
        ["actions", t(this.lang, "navActions")],
        ["memories", t(this.lang, "navMemories")],
        ["questions", t(this.lang, "navQuestionsLessons")],
        ["searches", t(this.lang, "navSearches")],
      ];
      for (const [id, label] of lifeTabs) {
        switcher.appendChild(
          el(
            "button",
            {
              type: "button",
              class: `popup-tab-pill${this.lifeTab === id ? " is-active" : ""}`,
              onClick: () => {
                if (this.lifeTab !== id) this.selectLifeTab(id);
              },
            },
            label,
          ),
        );
      }
    }

    this.tabPopupHeaderEl.append(titleRow, switcher);
  }

  private renderToken = 0;

  private async renderActiveContentTab(keepScroll = false): Promise<void> {
    if (!this.popupOpen) return;
    const token = ++this.renderToken;
    const scrollTop = keepScroll ? this.tabPopupBodyEl.scrollTop : 0;
    const popupBody = el("div", { class: "tab-popup-body" });
    this.tabPopupBodyEl.replaceWith(popupBody);
    this.tabPopupBodyEl = popupBody;
    const inspect = (id: number) => {
      void openContextModal(this.contextModalEl, this.api, id, this.lang);
    };
    if (this.section === "life" && this.lifeTab !== "live") {
      await renderLifeTab(popupBody, this.lifeTab, this.api, this.lang, inspect);
    } else if (this.section === "lab") {
      await renderLabTab(
        popupBody,
        this.labTab,
        this.api,
        this.snapshot,
        this.events,
        this.lang,
        inspect,
      );
    }
    // A newer render replaced this one while it was loading; do not touch its scroll.
    if (keepScroll && token === this.renderToken) popupBody.scrollTop = scrollTop;
  }

  private setLang(lang: UiLang): void {
    this.lang = lang;
    this.renderedStatusChips = "";
    this.renderChrome();
    this.renderFrame();
    if (this.popupOpen) {
      this.renderPopupHeader();
      void this.renderActiveContentTab();
    }
    if (!this.contextModalEl.hidden) {
      const openId = Number(this.contextModalEl.dataset["entryId"] ?? 0);
      if (openId > 0) void openContextModal(this.contextModalEl, this.api, openId, this.lang);
    }
    if (this.searchOpen) {
      if (this.searchQuery) void this.executeSearch();
      else this.renderSearch(false);
    }
  }

  private async executeSearch(): Promise<void> {
    if (!this.searchQuery) {
      this.searchResponse = null;
      this.renderSearch(false);
      return;
    }
    this.searchResponse = null;
    this.renderSearch(false);
    this.searchResponse = await runSearch(
      this.api,
      this.searchQuery,
      this.searchCategory,
      this.lang,
    );
    this.renderSearch(false);
  }

  private renderSearch(focusInput: boolean): void {
    renderSearchPalette(
      this.searchPaletteEl,
      this.searchOpen,
      this.searchResponse,
      this.searchQuery,
      this.searchCategory,
      this.lang,
      {
        api: this.api,
        onSubmitQuery: (query) => {
          this.searchQuery = query;
          void this.executeSearch();
        },
        onFilterCategory: (cat) => {
          this.searchCategory = cat;
          if (this.searchQuery) {
            void this.executeSearch();
          } else {
            this.renderSearch(false);
          }
        },
        onInspectContext: (entryId) => {
          void openContextModal(this.contextModalEl, this.api, entryId, this.lang);
        },
        onClose: () => this.closeSearchPalette(),
      },
      focusInput,
    );
  }
}

const mount = document.getElementById("app");
if (mount) {
  new ViewerApp(mount);
}
