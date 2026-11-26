import type { Event, SearchResponse, Snapshot } from "@truman/contracts";
import "./styles.css";
import { createViewerApiClient, type SnapshotFeedResult, type StatusPayload } from "./api/client";
import { stationLabel, t, translateDynamic, type UiLang } from "./i18n";
import { WorldScene, type CameraMode } from "./scene/worldScene";
import { evaluateTimeline, getTimelineBounds, type TimelineState } from "./state/timeline";
import { clear, el, formatDateTime } from "./ui/dom";
import { renderLabTab, type LabTab } from "./ui/labViews";
import { renderLifeTab, type LifeTab } from "./ui/lifeViews";
import { openContextModal, renderSearchPanel, runSearch } from "./ui/searchAndContext";
import { renderTimelineBar } from "./ui/timelineBar";
import { renderVitalsHud } from "./ui/vitalsHud";

type Section = "life" | "lab";

const SPEEDS = [1, 2, 5];
const SNAPSHOT_REFRESH_MS = 60_000;

class ViewerApp {
  private readonly api = createViewerApiClient();
  private lang: UiLang = "en";
  private section: Section = "life";
  private lifeTab: LifeTab = "live";
  private labTab: LabTab = "organism";
  private popupOpen = false;

  private snapshot: Snapshot | null = null;
  private events: Event[] = [];
  private status: StatusPayload | null = null;
  private feedState: SnapshotFeedResult["state"] | "loading" = "loading";

  private isLive = true;
  private isPlaying = true;
  private speedIdx = 0;
  private playheadMs = Date.now();
  private cameraMode: CameraMode = "cabin";

  private searchQuery = "";
  private searchCategory: "all" | "life" | "lab" = "all";
  private searchResponse: SearchResponse | null = null;

  private worldScene: WorldScene | null = null;
  private sceneInitialized = false;
  private renderedThought = "";
  private renderedAction = "";

  // Mounted containers
  private readonly root: HTMLElement;
  private topbarEl!: HTMLElement;
  private subnavEl!: HTMLElement;
  private feedBadgeEl!: HTMLElement;
  private statusStripEl!: HTMLElement;
  private feedNoticeEl!: HTMLElement;
  private searchDrawerEl!: HTMLElement;
  private mainAreaEl!: HTMLElement;
  private liveGridEl!: HTMLElement;
  private canvasHostEl!: HTMLElement;
  private thoughtOverlayEl!: HTMLElement;
  private nowDoingOverlayEl!: HTMLElement;
  private hudSidebarEl!: HTMLElement;
  private timelineBarEl!: HTMLElement;
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
  }

  private bindGlobalKeys(): void {
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!this.contextModalEl.hidden) {
        this.contextModalEl.hidden = true;
        clear(this.contextModalEl);
        return;
      }
      if (this.popupOpen) {
        this.closePopup();
        return;
      }
      if (!this.searchDrawerEl.hidden) {
        this.searchQuery = "";
        this.searchResponse = null;
        this.searchDrawerEl.hidden = true;
        this.renderChrome();
      }
    });
  }

  private mountShell(): void {
    clear(this.root);

    this.topbarEl = el("header", { class: "topbar" });
    this.subnavEl = el("nav", { class: "subnav-bar" });
    this.feedBadgeEl = el("span", { class: "badge", role: "status" });
    this.statusStripEl = el("div", { class: "status-strip" });
    this.feedNoticeEl = el("p", { class: "feed-notice" });
    this.searchDrawerEl = el("section", { class: "search-drawer" });
    this.searchDrawerEl.hidden = true;

    this.canvasHostEl = el("div", { class: "canvas-host" });
    this.thoughtOverlayEl = el("div", { class: "thought-bubble" });
    this.nowDoingOverlayEl = el("div", { class: "now-doing-pill" });

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
      el("div", { class: "stage-overlay-bottom" }, this.nowDoingOverlayEl),
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

    this.timelineBarEl = el("footer", { class: "timeline-bar" });
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
      this.searchDrawerEl,
      this.mainAreaEl,
      this.timelineBarEl,
      this.tabPopupBackdropEl,
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
      this.snapshot = feed.snapshot;
      this.events = feed.events;
      this.status = feed.status;
      this.feedState = feed.state;
      this.renderFeedStatus();

      if (this.snapshot) {
        if (!this.sceneInitialized) this.initScene();
        this.worldScene?.setSeed(this.snapshot.world.seed);
        const { startMs, endMs } = getTimelineBounds(this.snapshot, this.events);
        if (!this.isLive) {
          this.playheadMs = Math.min(endMs, Math.max(startMs, this.playheadMs));
        } else if (feed.state !== "demo") {
          this.playheadMs = Date.now();
        } else if (!wasDemo) {
          this.playheadMs = startMs + 8_000;
        }
        this.renderFrame();
      }

      if (!this.api.snapshotBase && this.popupOpen) {
        void this.renderActiveContentTab();
      }
    } finally {
      if (this.api.snapshotBase || this.api.apiBase) {
        window.setTimeout(() => void this.refreshFeed(), SNAPSHOT_REFRESH_MS);
      }
    }
  }

  private startPlaybackClock(): void {
    let last = performance.now();
    window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (!this.snapshot) return;
      if (this.isPlaying) {
        if (this.isLive && this.feedState !== "demo") {
          this.playheadMs = Date.now();
        } else {
          const { startMs, endMs } = getTimelineBounds(this.snapshot, this.events);
          const speed = SPEEDS[this.speedIdx] ?? 1;
          this.playheadMs += dt * speed;
          if (this.playheadMs > endMs) {
            this.playheadMs = this.feedState === "demo" ? startMs : endMs;
          }
        }
      }
      this.renderFrame();
    }, 250);
  }

  private renderChrome(): void {
    this.root.classList.toggle("is-lab-mode", this.section === "lab");

    // Topbar
    clear(this.topbarEl);
    const searchInput = el("input", {
      type: "search",
      class: "search-input",
      placeholder: t(this.lang, "searchPlaceholder"),
      value: this.searchQuery,
      "aria-label": t(this.lang, "searchButton"),
    });

    const searchForm = el(
      "form",
      {
        class: "search-form",
        onSubmit: (e) => {
          e.preventDefault();
          this.searchQuery = searchInput.value.trim();
          void this.executeSearch();
        },
      },
      searchInput,
      el("button", { type: "submit", class: "pill-btn" }, t(this.lang, "searchButton")),
    );

    this.topbarEl.append(
      el(
        "div",
        { class: "brand" },
        el("span", null, t(this.lang, "appTitle")),
        el("span", { class: "badge" }, t(this.lang, "readOnlyBadge")),
        this.feedBadgeEl,
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
      searchForm,
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

    // Camera buttons overlay
    const camBox = document.getElementById("camera-controls");
    if (camBox) {
      clear(camBox);
      const cams: Array<[CameraMode, string]> = [
        ["cabin", t(this.lang, "cameraCabin")],
        ["follow", t(this.lang, "cameraFollow")],
        ["world", t(this.lang, "cameraWorld")],
      ];
      for (const [mode, label] of cams) {
        camBox.appendChild(
          el(
            "button",
            {
              type: "button",
              class: `pill-btn${this.cameraMode === mode ? " is-active" : ""}`,
              onClick: () => {
                this.cameraMode = mode;
                this.worldScene?.setCameraMode(mode);
                this.renderChrome();
              },
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

    this.timelineBarEl.hidden = !snapshot;
    this.feedNoticeEl.hidden = !!snapshot;
    this.feedNoticeEl.textContent =
      this.feedState === "loading"
        ? t(this.lang, "loading")
        : t(this.lang, "feedUnavailableNotice");
    this.canvasHostEl.hidden = !snapshot;
    this.hudSidebarEl.hidden = !snapshot;
    this.nowDoingOverlayEl.hidden = !snapshot;
    if (!snapshot) this.thoughtOverlayEl.style.display = "none";

    clear(this.statusStripEl);
    this.statusStripEl.append(
      el("span", { class: "cadence-disclaimer" }, t(this.lang, "decisionCadenceNotice")),
    );
    if (!snapshot) return;
    const day = this.status?.world_day ?? this.status?.day;
    const season = this.status?.season;
    const phase = this.status?.phase ?? snapshot.resident.phase;
    if (day != null)
      this.statusStripEl.append(el("span", null, `${t(this.lang, "dayLabel")} ${day}`));
    if (season)
      this.statusStripEl.append(el("span", null, `${t(this.lang, "seasonLabel")}: ${season}`));
    if (phase)
      this.statusStripEl.append(el("span", null, `${t(this.lang, "phaseLabel")}: ${phase}`));
    if (this.feedState === "stale") {
      this.statusStripEl.append(
        el(
          "span",
          null,
          `${t(this.lang, "feedLastUpdate")}: ${formatDateTime(snapshot.generated_at)}`,
        ),
      );
    }
  }

  private renderFrame(): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    const evaluated = evaluateTimeline(snapshot, this.events, this.playheadMs);
    this.worldScene?.applyTimelineState(evaluated);

    this.renderThought(evaluated);
    this.renderAction(evaluated);

    // Vitals & Body HUD
    renderVitalsHud(this.hudSidebarEl, snapshot, evaluated, this.lang);

    // Timeline bar
    renderTimelineBar(
      this.timelineBarEl,
      {
        isLive: this.isLive,
        isPlaying: this.isPlaying,
        speed: SPEEDS[this.speedIdx] ?? 1,
        events: this.events,
        evaluated,
        lang: this.lang,
      },
      {
        onToggleLive: () => {
          this.isLive = true;
          this.isPlaying = true;
          const bounds = getTimelineBounds(snapshot, this.events);
          this.playheadMs = this.feedState === "demo" ? bounds.startMs : Date.now();
          this.renderFrame();
        },
        onTogglePlay: () => {
          this.isPlaying = !this.isPlaying;
          if (!this.isPlaying) this.isLive = false;
          this.renderFrame();
        },
        onScrub: (nextMs) => {
          this.isLive = false;
          this.isPlaying = false;
          this.playheadMs = nextMs;
          this.renderFrame();
        },
        onCycleSpeed: () => {
          if (this.feedState !== "demo") this.isLive = false;
          this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
          this.renderFrame();
        },
      },
    );
  }

  private renderThought(evaluated: TimelineState): void {
    const { thought, thinking, thoughtLogId } = evaluated;
    const identity = JSON.stringify([this.lang, thought, thinking, thoughtLogId]);
    if (this.renderedThought === identity) return;
    this.renderedThought = identity;
    clear(this.thoughtOverlayEl);
    this.thoughtOverlayEl.style.display = thought || thinking ? "block" : "none";
    if (!thought && !thinking) return;

    this.thoughtOverlayEl.append(
      el("div", { class: "thought-bubble-label" }, t(this.lang, "thoughtBubbleLabel")),
    );
    if (thought) {
      const text = el("p", { class: "thought-bubble-text" }, thought);
      this.thoughtOverlayEl.append(text);
      if (this.lang === "pt-BR") {
        void translateDynamic(thought, this.lang).then((res) => {
          text.textContent = res.isFallback ? `${res.text} [EN]` : res.text;
        });
      }
    } else {
      const context = this.contextButton(thoughtLogId);
      if (context) this.thoughtOverlayEl.append(context);
    }
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

  private async renderActiveContentTab(): Promise<void> {
    if (!this.popupOpen) return;
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
  }

  private setLang(lang: UiLang): void {
    this.lang = lang;
    this.renderChrome();
    this.renderFrame();
    if (this.popupOpen) {
      this.renderPopupHeader();
      void this.renderActiveContentTab();
    }
    if (this.searchQuery) {
      void this.executeSearch();
    }
  }

  private async executeSearch(): Promise<void> {
    if (!this.searchQuery) {
      this.searchResponse = null;
      this.searchDrawerEl.hidden = true;
      return;
    }
    this.searchResponse = null;
    this.renderSearch();
    this.searchResponse = await runSearch(
      this.api,
      this.searchQuery,
      this.searchCategory,
      this.lang,
    );
    this.renderSearch();
  }

  private renderSearch(): void {
    renderSearchPanel(
      this.searchDrawerEl,
      this.searchResponse,
      this.searchQuery,
      this.searchCategory,
      this.lang,
      {
        onFilterCategory: (cat) => {
          this.searchCategory = cat;
          void this.executeSearch();
        },
        onInspectContext: (entryId) => {
          void openContextModal(this.contextModalEl, this.api, entryId, this.lang);
        },
        onClose: () => {
          this.searchQuery = "";
          this.searchResponse = null;
          this.searchDrawerEl.hidden = true;
          this.renderChrome();
        },
      },
    );
  }
}

const mount = document.getElementById("app");
if (mount) {
  new ViewerApp(mount);
}
