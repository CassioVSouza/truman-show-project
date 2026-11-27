import type { Snapshot } from "@truman/contracts";
import { t, type UiLang } from "../i18n";
import type { TimelineState } from "../state/timeline";
import { clear, el } from "./dom";
import { FLAT_VITAL_TRENDS, type VitalTrend, type VitalTrends } from "./hudHelpers";

export interface VitalsHudOptions {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  trends?: VitalTrends;
  mobileExpanded?: boolean;
  onToggleMobile?: () => void;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function trendBadge(trend: VitalTrend): HTMLElement | null {
  if (trend === "flat") return null;
  const arrow = trend === "up" ? "↑" : "↓";
  return el("span", { class: `vital-trend is-${trend}` }, arrow);
}

function vitalBar(
  label: string,
  valuePct: number,
  valueText: string,
  tone: string,
  trend: VitalTrend,
): HTMLElement {
  const pct = clampPct(valuePct);
  const lowClass = pct < 25 ? " is-low" : "";
  return el(
    "div",
    { class: `vital-row${lowClass}` },
    el(
      "div",
      { class: "vital-header" },
      el("span", { class: "vital-label" }, label),
      el("span", { class: "vital-value tabular-num" }, valueText, trendBadge(trend)),
    ),
    el(
      "div",
      { class: "vital-track" },
      el("div", { class: `vital-fill tone-${tone}`, style: `width: ${pct}%` }),
    ),
  );
}

function slimVitalDot(
  icon: string,
  label: string,
  valuePct: number,
  valueText: string,
  tone: string,
  onExpand?: () => void,
): HTMLElement {
  const pct = clampPct(valuePct);
  const lowClass = pct < 25 ? " is-low" : "";
  return el(
    "button",
    {
      type: "button",
      class: `slim-vital-btn${lowClass}`,
      title: `${label}: ${valueText}`,
      "aria-label": `${label}: ${valueText}`,
      onClick: onExpand,
    },
    el("span", { class: "slim-vital-icon" }, icon),
    el(
      "span",
      { class: "slim-vital-bar" },
      el("span", { class: `slim-vital-fill tone-${tone}`, style: `height: ${pct}%` }),
    ),
  );
}

export function renderVitalsHud(
  container: HTMLElement,
  snapshot: Snapshot,
  state: TimelineState,
  lang: UiLang,
  options: VitalsHudOptions = {},
): void {
  clear(container);

  const vitals = snapshot.resident.vitals;
  const phys = state.physiology;
  const alive = state.alive && vitals.alive;
  const trends = options.trends ?? FLAT_VITAL_TRENDS;
  const collapsed = Boolean(options.collapsed);
  const mobileExpanded = Boolean(options.mobileExpanded);

  container.classList.toggle("is-collapsed", collapsed);
  container.classList.toggle("is-mobile-expanded", mobileExpanded);

  const hr = Math.max(30, Math.min(190, Math.round(phys.heart_rate)));
  const br = Math.max(4, Math.min(45, Math.round(phys.breath_rate)));
  const hrPeriod = alive ? (60 / hr).toFixed(2) : "0";
  const brPeriod = alive ? (60 / br).toFixed(2) : "0";
  const tempPct = ((vitals.core_temp - 34) / 6) * 100;

  // Mobile expandable bottom-sheet handle (hidden on desktop via CSS)
  const mobileHandle = el(
    "button",
    {
      type: "button",
      class: "mobile-sheet-handle",
      "aria-label": t(lang, "mobileVitalsHandle"),
      onClick: options.onToggleMobile,
    },
    el("span", { class: "mobile-sheet-pill" }),
    el(
      "span",
      { class: "mobile-sheet-summary" },
      el("strong", null, t(lang, "mobileVitalsHandle")),
      el(
        "span",
        { class: "mobile-sheet-metrics tabular-num" },
        alive
          ? `♥ ${hr} · ${t(lang, "vitalHealth")} ${Math.round(vitals.health)}% · ${vitals.core_temp.toFixed(1)}°C`
          : t(lang, "memorialTitle"),
      ),
      el("span", { class: "mobile-sheet-chevron" }, mobileExpanded ? "▾" : "▴"),
    ),
  );
  container.appendChild(mobileHandle);

  // Desktop slim icon strip when collapsed
  if (collapsed) {
    const strip = el(
      "div",
      { class: "hud-slim-strip" },
      el(
        "button",
        {
          type: "button",
          class: "sidebar-toggle-btn",
          title: t(lang, "sidebarExpand"),
          "aria-label": t(lang, "sidebarExpand"),
          onClick: options.onToggleCollapse,
        },
        "◂",
      ),
      slimVitalDot(
        "♥",
        t(lang, "vitalHealth"),
        vitals.health,
        `${Math.round(vitals.health)}%`,
        "health",
        options.onToggleCollapse,
      ),
      slimVitalDot(
        "🍞",
        t(lang, "vitalSatiety"),
        vitals.satiety,
        `${Math.round(vitals.satiety)}%`,
        "satiety",
        options.onToggleCollapse,
      ),
      slimVitalDot(
        "💧",
        t(lang, "vitalHydration"),
        vitals.hydration,
        `${Math.round(vitals.hydration)}%`,
        "hydration",
        options.onToggleCollapse,
      ),
      slimVitalDot(
        "🌡",
        t(lang, "vitalWarmth"),
        tempPct,
        `${vitals.core_temp.toFixed(1)} °C`,
        vitals.core_temp < 35.8 ? "cold" : "warmth",
        options.onToggleCollapse,
      ),
      slimVitalDot(
        "⚡",
        t(lang, "vitalEnergy"),
        vitals.stamina,
        `${Math.round(vitals.stamina)}%`,
        "energy",
        options.onToggleCollapse,
      ),
    );
    container.appendChild(strip);
    return;
  }

  const contentWrap = el("div", { class: "hud-content-wrap" });

  // Death / Memorial banner
  if (!alive) {
    contentWrap.appendChild(
      el(
        "div",
        { class: "memorial-banner" },
        el("h3", null, t(lang, "memorialTitle")),
        el("p", null, t(lang, "memorialSubtitle")),
        el(
          "div",
          { class: "memorial-cause" },
          el("strong", null, `${t(lang, "causeOfDeath")}: `),
          state.causeOfDeath ?? vitals.cause_of_death ?? "—",
        ),
      ),
    );
  }

  // Heartbeat & Breathing visual panel + desktop collapse button
  const bodyHeader = el(
    "div",
    { class: "hud-card-header" },
    el("h3", { class: "hud-card-title" }, t(lang, "bodyPanelTitle")),
    options.onToggleCollapse
      ? el(
          "button",
          {
            type: "button",
            class: "sidebar-toggle-btn is-inline",
            title: t(lang, "sidebarCollapse"),
            "aria-label": t(lang, "sidebarCollapse"),
            onClick: options.onToggleCollapse,
          },
          "▸",
        )
      : null,
  );

  const bodyPanel = el(
    "section",
    { class: "hud-card" },
    bodyHeader,
    el(
      "div",
      { class: "bio-grid" },
      el(
        "div",
        { class: "bio-tile" },
        el(
          "div",
          {
            class: alive ? "pulse-heart is-beating" : "pulse-heart is-still",
            style: `--hr-period: ${hrPeriod}s`,
            "aria-label": t(lang, "heartRate"),
          },
          "♥",
        ),
        el(
          "div",
          { class: "bio-meta" },
          el("span", { class: "bio-label" }, t(lang, "heartRate")),
          el(
            "strong",
            { class: "bio-reading tabular-num" },
            alive ? `${hr} ${t(lang, "bpmUnit")}` : "0",
          ),
        ),
      ),
      el(
        "div",
        { class: "bio-tile" },
        el(
          "div",
          {
            class: alive ? "breath-ring is-breathing" : "breath-ring is-still",
            style: `--br-period: ${brPeriod}s`,
            "aria-label": t(lang, "breathRate"),
          },
          el("span", { class: "breath-core" }),
        ),
        el(
          "div",
          { class: "bio-meta" },
          el("span", { class: "bio-label" }, t(lang, "breathRate")),
          el(
            "strong",
            { class: "bio-reading tabular-num" },
            alive ? `${br} ${t(lang, "rpmUnit")}` : "0",
          ),
        ),
      ),
    ),
  );
  contentWrap.appendChild(bodyPanel);

  // Vitals bars (Spectator-only; never visible to Resident)
  const vitalsCard = el(
    "section",
    { class: "hud-card" },
    el("h3", { class: "hud-card-title" }, t(lang, "hudTitle")),
    vitalBar(
      t(lang, "vitalHealth"),
      vitals.health,
      `${Math.round(vitals.health)}%`,
      "health",
      trends.health,
    ),
    vitalBar(
      t(lang, "vitalSatiety"),
      vitals.satiety,
      `${Math.round(vitals.satiety)}%`,
      "satiety",
      trends.satiety,
    ),
    vitalBar(
      t(lang, "vitalHydration"),
      vitals.hydration,
      `${Math.round(vitals.hydration)}%`,
      "hydration",
      trends.hydration,
    ),
    vitalBar(
      t(lang, "vitalWarmth"),
      tempPct,
      `${vitals.core_temp.toFixed(1)} °C`,
      vitals.core_temp < 35.8 ? "cold" : "warmth",
      trends.core_temp,
    ),
    vitalBar(
      t(lang, "vitalEnergy"),
      vitals.stamina,
      `${Math.round(vitals.stamina)}%`,
      "energy",
      trends.stamina,
    ),
    vitalBar(
      t(lang, "vitalSleep"),
      vitals.sleep_pressure * 100,
      `${Math.round(vitals.sleep_pressure * 100)}%`,
      "sleep",
      trends.sleep_pressure,
    ),
  );
  contentWrap.appendChild(vitalsCard);

  // Wounds & Conditions
  const woundsList =
    vitals.wounds.length === 0 && vitals.conditions.length === 0
      ? el("p", { class: "muted-note" }, t(lang, "noWounds"))
      : el(
          "div",
          { class: "chip-row" },
          ...vitals.wounds.map((w) =>
            el(
              "span",
              { class: "chip chip-danger tabular-num" },
              `${w.type} (${w.location}) ${Math.round(w.severity * 100)}%${w.infected ? " · infected" : ""}`,
            ),
          ),
          ...vitals.conditions.map((c) =>
            el(
              "span",
              { class: "chip chip-warn tabular-num" },
              `${c.name} ${Math.round(c.severity * 100)}%`,
            ),
          ),
        );

  contentWrap.appendChild(
    el(
      "section",
      { class: "hud-card" },
      el("h3", { class: "hud-card-title" }, t(lang, "woundsTitle")),
      woundsList,
    ),
  );

  // Inventory
  const invList =
    snapshot.resident.inventory.length === 0
      ? el("p", { class: "muted-note" }, t(lang, "emptyInventory"))
      : el(
          "div",
          { class: "chip-row" },
          ...snapshot.resident.inventory.map((it) =>
            el("span", { class: "chip tabular-num" }, `${it.item.replace(/_/g, " ")} ×${it.qty}`),
          ),
        );

  contentWrap.appendChild(
    el(
      "section",
      { class: "hud-card" },
      el("h3", { class: "hud-card-title" }, t(lang, "inventoryTitle")),
      invList,
    ),
  );

  container.appendChild(contentWrap);
}
