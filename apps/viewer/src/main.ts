import type { Event, SearchResponse, Snapshot } from "@truman/contracts";
import "./styles.css";
import { createViewerApiClient, type StatusPayload } from "./api/client";
import { DEMO_EVENTS, DEMO_SNAPSHOT, DEMO_STATUS } from "./api/demoData";
import { stationLabel, t, translateDynamic, type UiLang } from "./i18n";
import { WorldScene, type CameraMode } from "./scene/worldScene";
import { evaluateTimeline, getTimelineBounds } from "./state/timeline";
import { clear, el } from "./ui/dom";
import { renderLabTab, type LabTab } from "./ui/labViews";
import { renderLifeTab, type LifeTab } from "./ui/lifeViews";
import { openContextModal, renderSearchPanel, runSearch } from "./ui/searchAndContext";
import { renderTimelineBar } from "./ui/timelineBar";
import { renderVitalsHud } from "./ui/vitalsHud";

type Section = "life" | "lab";

const SPEEDS = [1, 2, 5];
// Static snapshot refresh interval: slow refresh (~60 s, once per tick window; never a 4 s Worker poll — decision 22).
const SNAPSHOT_REFRESH_MS = 60_000;

class ViewerApp {
  private readonly api = createViewerApiClient();
  private lang: UiLang = "en";
  private section: Section = "life";
  private lifeTab: LifeTab = "live";
  private labTab: LabTab = "organism";

  private snapshot: Snapshot = DEMO_SNAPSHOT;
  private events: Event[] = DEMO_EVENTS;
  private status: StatusPayload = DEMO_STATUS;
  private isDemo = true;

  private isLive = true;
  private isPlaying = true;
  private speedIdx = 0;
  private playheadMs = Date.now();
  private cameraMode: CameraMode = "cabin";

  private searchQuery = "";
  private searchCategory: "all" | "life" | "lab" = "all";
  private searchResponse: SearchResponse | null = null;

  private worldScene: WorldScene | null = null;

  // Mounted containers
  private readonly root: HTMLElement;
  private topbarEl!: HTMLElement;
  private subnavEl!: HTMLElement;
  private searchDrawerEl!: HTMLElement;
  private mainAreaEl!: HTMLElement;
  private liveGridEl!: HTMLElement;
  private canvasHostEl!: HTMLElement;
  private thoughtOverlayEl!: HTMLElement;
  private nowDoingOverlayEl!: HTMLElement;
  private hudSidebarEl!: HTMLElement;
  private timelineBarEl!: HTMLElement;
  private contentPaneEl!: HTMLElement;
  private contextModalEl!: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.mountShell();
    this.initScene();
    void this.refreshFeed();
    this.startPlaybackClock();
    window.setInterval(() => {
      void this.refreshFeed();
    }, SNAPSHOT_REFRESH_MS);
  }

  private mountShell(): void {
    clear(this.root);

    this.topbarEl = el("header", { class: "topbar" });
    this.subnavEl = el("nav", { class: "subnav-bar" });
    this.searchDrawerEl = el("section", { class: "search-drawer" });
    this.searchDrawerEl.hidden = true;

    this.canvasHostEl = el("div", { class: "canvas-host" });
    this.thoughtOverlayEl = el("div", { class: "thought-bubble" });
    this.nowDoingOverlayEl = el("div", { class: "now-doing-pill" });

    const stageWrap = el(
      "div",
      { class: "stage-wrap" },
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

    this.contentPaneEl = el("section", { class: "content-pane" });
    this.contentPaneEl.hidden = true;

    this.timelineBarEl = el("footer", { class: "timeline-bar" });
    this.mainAreaEl = el("main", { class: "main-area" }, this.liveGridEl, this.contentPaneEl);
    this.contextModalEl = el("div", { class: "modal-backdrop" });
    this.contextModalEl.hidden = true;
    this.contextModalEl.addEventListener("click", (e) => {
      if (e.target === this.contextModalEl) {
        this.contextModalEl.hidden = true;
      }
    });

    this.root.append(
      this.topbarEl,
      this.subnavEl,
      this.searchDrawerEl,
      this.mainAreaEl,
      this.timelineBarEl,
      this.contextModalEl,
    );

    this.renderChrome();
  }

  private initScene(): void {
    try {
      this.worldScene = new WorldScene(this.canvasHostEl);
      this.worldScene.setSeed(this.snapshot.world.seed);
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
    const [feed, st] = await Promise.all([this.api.fetchSnapshotFeed(), this.api.getStatus()]);
    this.snapshot = feed.snapshot;
    this.events = feed.events;
    this.status = st.data;
    this.isDemo = feed.demo;

    const bounds = getTimelineBounds(this.snapshot, this.events);
    if (this.isLive) {
      // In demo mode, start near the beginning of the sample window so spectators immediately watch movement.
      this.playheadMs = this.isDemo ? bounds.startMs + 8_000 : Math.min(Date.now(), bounds.endMs);
    }

    this.worldScene?.setSeed(this.snapshot.world.seed);
    this.renderChrome();
    this.renderFrame();
    if (!(this.section === "life" && this.lifeTab === "live")) {
      void this.renderActiveContentTab();
    }
  }

  private startPlaybackClock(): void {
    let last = performance.now();
    window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const bounds = getTimelineBounds(this.snapshot, this.events);

      if (this.isPlaying) {
        const speed = SPEEDS[this.speedIdx] ?? 1;
        this.playheadMs += dt * speed;
        if (this.playheadMs > bounds.endMs) {
          this.playheadMs = this.isDemo ? bounds.startMs : bounds.endMs;
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

    const alive = this.snapshot.resident.vitals.alive && this.status.status !== "dead";
    const statusBadge = !alive
      ? el("span", { class: "badge badge-dead" }, t(this.lang, "deadBadge"))
      : this.isDemo
        ? el("span", { class: "badge badge-demo" }, t(this.lang, "demoBadge"))
        : el("span", { class: "badge badge-live" }, t(this.lang, "liveBadge"));

    this.topbarEl.append(
      el(
        "div",
        { class: "brand" },
        el("span", null, t(this.lang, "appTitle")),
        el("span", { class: "badge" }, t(this.lang, "readOnlyBadge")),
        statusBadge,
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
        tabsEl.appendChild(
          el(
            "button",
            {
              type: "button",
              class: `tab-btn${this.lifeTab === id ? " is-active" : ""}`,
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
        tabsEl.appendChild(
          el(
            "button",
            {
              type: "button",
              class: `tab-btn${this.labTab === id ? " is-active" : ""}`,
              onClick: () => this.selectLabTab(id),
            },
            label,
          ),
        );
      }
    }

    const statusStrip = el(
      "div",
      { class: "status-strip" },
      el(
        "span",
        null,
        `${t(this.lang, "dayLabel")} ${this.status.world_day ?? this.status.day ?? 1}`,
      ),
      el("span", null, `${t(this.lang, "seasonLabel")}: ${this.status.season ?? "spring"}`),
      el(
        "span",
        null,
        `${t(this.lang, "phaseLabel")}: ${this.status.phase ?? this.snapshot.resident.phase}`,
      ),
    );
    this.subnavEl.append(tabsEl, statusStrip);

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

  private renderFrame(): void {
    const evaluated = evaluateTimeline(this.snapshot, this.events, this.playheadMs);
    this.worldScene?.applyTimelineState(evaluated);

    // Thought bubble
    clear(this.thoughtOverlayEl);
    if (evaluated.thought) {
      this.thoughtOverlayEl.style.display = "block";
      const thoughtP = el("p", { class: "thought-bubble-text" }, evaluated.thought);
      this.thoughtOverlayEl.append(
        el("div", { class: "thought-bubble-label" }, t(this.lang, "thoughtBubbleLabel")),
        thoughtP,
      );
      if (this.lang === "pt-BR") {
        void translateDynamic(evaluated.thought, this.lang).then((res) => {
          thoughtP.textContent = res.isFallback ? `${res.text} [EN]` : res.text;
        });
      }
    } else {
      this.thoughtOverlayEl.style.display = "none";
    }

    // Now-doing line
    clear(this.nowDoingOverlayEl);
    this.nowDoingOverlayEl.append(
      el("strong", null, `${t(this.lang, "nowDoing")}: `),
      `${evaluated.activeActionLabel} · ${t(this.lang, "stationLabel")}: ${stationLabel(this.lang, evaluated.station)} · ${t(this.lang, "weatherLabel")}: ${evaluated.weather} (${evaluated.timeOfDay})`,
    );

    // Vitals & Body HUD
    renderVitalsHud(this.hudSidebarEl, this.snapshot, evaluated, this.lang);

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
          const bounds = getTimelineBounds(this.snapshot, this.events);
          this.playheadMs = this.isDemo ? bounds.startMs : bounds.endMs;
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
          this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
          this.renderFrame();
        },
      },
    );
  }

  private switchSection(sec: Section): void {
    this.section = sec;
    this.updateViewVisibility();
    this.renderChrome();
    if (!(this.section === "life" && this.lifeTab === "live")) {
      void this.renderActiveContentTab();
    }
  }

  private selectLifeTab(tab: LifeTab): void {
    this.section = "life";
    this.lifeTab = tab;
    this.updateViewVisibility();
    this.renderChrome();
    if (tab !== "live") {
      void this.renderActiveContentTab();
    }
  }

  private selectLabTab(tab: LabTab): void {
    this.section = "lab";
    this.labTab = tab;
    this.updateViewVisibility();
    this.renderChrome();
    void this.renderActiveContentTab();
  }

  private updateViewVisibility(): void {
    const showLive = this.section === "life" && this.lifeTab === "live";
    this.liveGridEl.hidden = !showLive;
    this.contentPaneEl.hidden = showLive;
  }

  private async renderActiveContentTab(): Promise<void> {
    const inspect = (id: number) => {
      void openContextModal(this.contextModalEl, this.api, id, this.lang);
    };
    if (this.section === "life" && this.lifeTab !== "live") {
      await renderLifeTab(this.contentPaneEl, this.lifeTab, this.api, this.lang, inspect);
    } else if (this.section === "lab") {
      await renderLabTab(
        this.contentPaneEl,
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
    if (!(this.section === "life" && this.lifeTab === "live")) {
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
