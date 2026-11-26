import type { Snapshot } from "@truman/contracts";
import { t, type UiLang } from "../i18n";
import type { TimelineState } from "../state/timeline";
import { clear, el } from "./dom";

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function vitalBar(label: string, valuePct: number, valueText: string, tone: string): HTMLElement {
  const pct = clampPct(valuePct);
  const lowClass = pct < 25 ? " is-low" : "";
  return el(
    "div",
    { class: `vital-row${lowClass}` },
    el(
      "div",
      { class: "vital-header" },
      el("span", { class: "vital-label" }, label),
      el("span", { class: "vital-value" }, valueText),
    ),
    el(
      "div",
      { class: "vital-track" },
      el("div", { class: `vital-fill tone-${tone}`, style: `width: ${pct}%` }),
    ),
  );
}

export function renderVitalsHud(
  container: HTMLElement,
  snapshot: Snapshot,
  state: TimelineState,
  lang: UiLang,
): void {
  clear(container);

  const vitals = snapshot.resident.vitals;
  const phys = state.physiology;
  const alive = state.alive && vitals.alive;

  // Death / Memorial banner
  if (!alive) {
    container.appendChild(
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

  // Heartbeat & Breathing visual panel
  const hr = Math.max(30, Math.min(190, Math.round(phys.heart_rate)));
  const br = Math.max(4, Math.min(45, Math.round(phys.breath_rate)));
  const hrPeriod = alive ? (60 / hr).toFixed(2) : "0";
  const brPeriod = alive ? (60 / br).toFixed(2) : "0";

  const bodyPanel = el(
    "section",
    { class: "hud-card" },
    el("h3", { class: "hud-card-title" }, t(lang, "bodyPanelTitle")),
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
          el("strong", { class: "bio-reading" }, alive ? `${hr} ${t(lang, "bpmUnit")}` : "0"),
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
          el("strong", { class: "bio-reading" }, alive ? `${br} ${t(lang, "rpmUnit")}` : "0"),
        ),
      ),
    ),
  );
  container.appendChild(bodyPanel);

  // Vitals bars (Spectator-only; never visible to Resident)
  const tempPct = ((vitals.core_temp - 34) / 6) * 100;
  const vitalsCard = el(
    "section",
    { class: "hud-card" },
    el("h3", { class: "hud-card-title" }, t(lang, "hudTitle")),
    vitalBar(t(lang, "vitalHealth"), vitals.health, `${Math.round(vitals.health)}%`, "health"),
    vitalBar(t(lang, "vitalSatiety"), vitals.satiety, `${Math.round(vitals.satiety)}%`, "satiety"),
    vitalBar(
      t(lang, "vitalHydration"),
      vitals.hydration,
      `${Math.round(vitals.hydration)}%`,
      "hydration",
    ),
    vitalBar(
      t(lang, "vitalWarmth"),
      tempPct,
      `${vitals.core_temp.toFixed(1)} °C`,
      vitals.core_temp < 35.8 ? "cold" : "warmth",
    ),
    vitalBar(t(lang, "vitalEnergy"), vitals.stamina, `${Math.round(vitals.stamina)}%`, "energy"),
    vitalBar(
      t(lang, "vitalSleep"),
      vitals.sleep_pressure * 100,
      `${Math.round(vitals.sleep_pressure * 100)}%`,
      "sleep",
    ),
  );
  container.appendChild(vitalsCard);

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
              { class: `chip chip-danger` },
              `${w.type} (${w.location}) ${Math.round(w.severity * 100)}%${w.infected ? " · infected" : ""}`,
            ),
          ),
          ...vitals.conditions.map((c) =>
            el("span", { class: "chip chip-warn" }, `${c.name} ${Math.round(c.severity * 100)}%`),
          ),
        );

  container.appendChild(
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
            el("span", { class: "chip" }, `${it.item.replace(/_/g, " ")} ×${it.qty}`),
          ),
        );

  container.appendChild(
    el(
      "section",
      { class: "hud-card" },
      el("h3", { class: "hud-card-title" }, t(lang, "inventoryTitle")),
      invList,
    ),
  );
}
