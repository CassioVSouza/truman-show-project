import type { Event, Snapshot } from "@truman/contracts";
import type { ViewerApiClient } from "../api/client";
import { t, toApiLang, type UiLang } from "../i18n";
import { clear, el, formatDateTime } from "./dom";
import { kvRowT } from "./translatable";

export type LabTab = "organism" | "appraisals" | "traces" | "governor" | "rawlog";

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function kvRow(label: string, value: string): HTMLElement | null {
  if (!value.trim()) return null;
  return el(
    "div",
    { class: "entry-kv" },
    el("span", { class: "entry-kv-label" }, label),
    el("span", { class: "entry-kv-val" }, value),
  );
}

function kvGroup(rows: Array<HTMLElement | null>): HTMLElement | null {
  const valid = rows.filter((r): r is HTMLElement => r !== null);
  if (valid.length === 0) return null;
  return el("div", { class: "entry-kv-list" }, ...valid);
}

function metricBar(label: string, raw: number, signed = false): HTMLElement {
  const pct = signed
    ? Math.max(0, Math.min(100, ((raw + 1) / 2) * 100))
    : Math.max(0, Math.min(100, raw * 100));
  return el(
    "div",
    { class: "metric-row" },
    el("span", { class: "metric-name" }, label.replace(/_/g, " ")),
    el(
      "div",
      { class: "metric-track" },
      el("div", { class: "metric-fill", style: `width: ${pct.toFixed(1)}%` }),
    ),
    el("span", { class: "metric-val" }, raw.toFixed(2)),
  );
}

function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function renderLabTab(
  container: HTMLElement,
  tab: LabTab,
  api: ViewerApiClient,
  snapshot: Snapshot | null,
  events: readonly Event[],
  lang: UiLang,
  onInspectContext: (entryId: number) => void,
): Promise<void> {
  clear(container);
  container.appendChild(el("div", { class: "lab-banner" }, t(lang, "labDisclaimer")));
  container.appendChild(el("p", { class: "muted-note" }, t(lang, "loading")));

  if (tab === "organism") {
    const { data } = await api.getList("organism", { lab: true, limit: 10 });
    clear(container);
    container.appendChild(el("div", { class: "lab-banner" }, t(lang, "labDisclaimer")));

    const latest = data.items[0];
    if (!latest) {
      container.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
      return;
    }

    const emotions = Array.isArray(latest["emotion_top3"])
      ? (latest["emotion_top3"] as Array<{ label?: string; weight?: number }>)
      : [];
    const org = (latest["organism"] ?? {}) as Record<string, unknown>;

    const grid = el("div", { class: "two-col-grid" });

    const emoCard = el(
      "section",
      { class: "panel-box" },
      el("h3", null, t(lang, "emotionAtlasTitle")),
      ...(emotions.length > 0
        ? emotions.map((e) => metricBar(str(e.label || "unknown"), num(e.weight)))
        : [el("p", { class: "muted-note" }, t(lang, "emptyState"))]),
    );

    const orgCard = el(
      "section",
      { class: "panel-box" },
      el("h3", null, t(lang, "organismStateTitle")),
      ...Object.entries(org).map(([k, v]) => metricBar(k, num(v), k === "valence")),
    );

    grid.append(emoCard, orgCard);
    container.appendChild(grid);
    return;
  }

  if (tab === "appraisals") {
    const [appRes, decRes] = await Promise.all([
      api.getList("appraisals", { lab: true, limit: 10 }),
      api.getList("decisions", { lab: true, limit: 15 }),
    ]);
    clear(container);
    container.appendChild(el("div", { class: "lab-banner" }, t(lang, "labDisclaimer")));

    const grid = el("div", { class: "two-col-grid" });

    // Appraisals
    const appCard = el(
      "section",
      { class: "panel-box" },
      el("h3", null, t(lang, "appraisalsTitle")),
    );
    const latestApp = appRes.data.items[0];
    if (latestApp && typeof latestApp["appraisal"] === "object" && latestApp["appraisal"]) {
      appCard.appendChild(
        el(
          "p",
          { class: "entry-sub" },
          `${str(latestApp["stimulus"])} · err ${num(latestApp["prediction_error"]).toFixed(2)}`,
        ),
      );
      for (const [k, v] of Object.entries(latestApp["appraisal"] as Record<string, unknown>)) {
        if (typeof v === "number") {
          const signed =
            k === "pleasantness" || k === "goal_congruence" || k === "self_compatibility";
          appCard.appendChild(metricBar(k, v, signed));
        } else {
          appCard.appendChild(el("p", { class: "entry-sub" }, `${k}: ${str(v)}`));
        }
      }
    } else {
      appCard.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
    }

    // Physiology (21 channels from snapshot)
    const physCard = el(
      "section",
      { class: "panel-box" },
      el("h3", null, t(lang, "physiologyChannelsTitle")),
      ...Object.entries(snapshot?.resident.body ?? {}).map(([k, v]) =>
        k === "heart_rate" || k === "breath_rate"
          ? el("p", { class: "entry-sub" }, `${k.replace(/_/g, " ")}: ${Number(v).toFixed(1)}`)
          : metricBar(k, num(v)),
      ),
      snapshot ? null : el("p", { class: "muted-note" }, t(lang, "feedUnavailableBadge")),
    );

    grid.append(appCard, physCard);
    container.appendChild(grid);

    // Decisions & prediction error
    const decList = el("div", { class: "card-list" });
    const decSec = el(
      "section",
      { class: "panel-box" },
      el("h3", null, `${t(lang, "decisionsTitle")} (${decRes.data.items.length})`),
    );
    if (decRes.data.items.length === 0) {
      decSec.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
    } else {
      for (const d of decRes.data.items) {
        decList.appendChild(
          el(
            "article",
            { class: "entry-card" },
            el(
              "div",
              { class: "entry-meta" },
              el("span", { class: "tag tag-lab" }, str(d["action_type"] ?? "decision")),
              el("span", { class: "tag" }, `err ${num(d["prediction_error"]).toFixed(2)}`),
              el("span", { class: "meta-ts" }, formatDateTime(str(d["ts"]))),
            ),
            kvGroup([
              kvRowT(t(lang, "intentLabel"), str(d["intent"]), lang),
              kvRowT(t(lang, "expectationLabel"), str(d["expectation"]), lang),
              kvRowT(t(lang, "outcomeLabel"), str(d["outcome"]), lang),
            ]),
          ),
        );
      }
      decSec.appendChild(decList);
    }
    container.appendChild(decSec);
    return;
  }

  if (tab === "traces") {
    const { data } = await api.getList("traces", { lab: true, limit: 25 });
    clear(container);
    container.appendChild(el("div", { class: "lab-banner" }, t(lang, "labDisclaimer")));

    if (data.items.length === 0) {
      container.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
      return;
    }

    const detailBox = el("div", { class: "trace-detail-box" });
    const list = el("div", { class: "card-list" });
    for (const tr of data.items) {
      const traceId = Number(tr["id"] ?? 0);
      list.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            el("span", { class: "tag tag-lab" }, str(tr["role"] ?? "llm")),
            el("span", { class: "tag" }, `${str(tr["provider"])} / ${str(tr["model"])}`),
            el(
              "span",
              { class: "meta-ts" },
              `${num(tr["tokens_in"])}→${num(tr["tokens_out"])} tok · ${num(tr["latency_ms"])}ms`,
            ),
            el(
              "button",
              {
                type: "button",
                class: "link-btn",
                onClick: async () => {
                  clear(detailBox);
                  detailBox.appendChild(el("p", { class: "muted-note" }, t(lang, "loading")));
                  const full = await api.getTrace(traceId);
                  clear(detailBox);
                  const payload = full.data ?? tr;
                  detailBox.appendChild(
                    el(
                      "div",
                      { class: "panel-box" },
                      el(
                        "div",
                        { class: "panel-header" },
                        el("h3", null, `Trace #${traceId} (${str(payload["provider"])})`),
                        el(
                          "button",
                          {
                            type: "button",
                            class: "ghost-btn",
                            onClick: () => clear(detailBox),
                          },
                          t(lang, "close"),
                        ),
                      ),
                      el("strong", { class: "entry-kv-label" }, t(lang, "tracePrompt")),
                      el(
                        "pre",
                        { class: "code-block" },
                        `${str(payload["system"])}\n\n${str(payload["prompt"])}`.trim() ||
                          JSON.stringify(payload, null, 2),
                      ),
                      el("strong", { class: "entry-kv-label" }, t(lang, "traceResponse")),
                      el("pre", { class: "code-block" }, str(payload["response"]) || "—"),
                    ),
                  );
                },
              },
              t(lang, "traceInspect"),
            ),
          ),
        ),
      );
    }
    container.append(detailBox, list);
    return;
  }

  if (tab === "governor") {
    const [govRes, toolsRes, errRes] = await Promise.all([
      api.getGovernor(),
      api.getList("tools", { lab: true, limit: 15 }),
      api.getList("errors", { lab: true, limit: 15 }),
    ]);
    clear(container);
    container.appendChild(el("div", { class: "lab-banner" }, t(lang, "labDisclaimer")));

    const gov = govRes.data;
    const size = (gov["size"] ?? {}) as Record<string, unknown>;
    const usage = Array.isArray(gov["usage"])
      ? (gov["usage"] as Array<Record<string, unknown>>)
      : [];

    const topGrid = el(
      "div",
      { class: "two-col-grid" },
      el(
        "section",
        { class: "panel-box" },
        el("h3", null, t(lang, "dbSizeLabel")),
        el("p", { class: "entry-text" }, `Mode: ${str(gov["mode"] ?? "normal")}`),
        el(
          "p",
          { class: "entry-sub" },
          `${num(size["mb"]).toFixed(2)} MB / ${num(size["limit_mb"], 500)} MB (${num(size["percent"]).toFixed(1)}%)`,
        ),
      ),
      el(
        "section",
        { class: "panel-box" },
        el("h3", null, t(lang, "dailyUsageLabel")),
        ...(usage.length > 0
          ? usage.map((u) => {
              const count = num(u["count"]);
              const cap = Math.max(1, num(u["cap"], 100));
              return metricBar(`${str(u["tool"])} (${count}/${cap})`, count / cap);
            })
          : [el("p", { class: "muted-note" }, t(lang, "emptyState"))]),
      ),
    );

    const toolsList = el("div", { class: "card-list" });
    for (const tc of toolsRes.data.items) {
      const rawInput = tc["input"];
      const inputSummary =
        typeof rawInput === "string"
          ? rawInput
          : rawInput && typeof rawInput === "object"
            ? JSON.stringify(rawInput)
            : str(tc["query"] ?? tc["url"]);
      const statusVal = tc["status"] ?? tc["status_code"];
      const bytesVal = tc["bytes"];
      const decision =
        tc["ok"] !== undefined
          ? tc["ok"]
            ? "ok"
            : "failed"
          : str(tc["ssrf_decision"] ?? "allowed");
      const errText = str(tc["error"]);
      const parts = [
        inputSummary,
        statusVal !== undefined ? `HTTP ${num(statusVal)}` : "",
        bytesVal !== undefined ? `${num(bytesVal)} B` : "",
        decision,
        errText ? `error: ${errText}` : "",
      ].filter(Boolean);
      toolsList.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            el("span", { class: "tag tag-lab" }, str(tc["tool"] ?? "tool")),
            el("span", { class: "meta-ts" }, parts.join(" · ")),
          ),
        ),
      );
    }

    const toolsSec = el(
      "section",
      { class: "panel-box" },
      el("h3", null, `${t(lang, "toolCallsTitle")} (${toolsRes.data.items.length})`),
      toolsRes.data.items.length > 0
        ? toolsList
        : el("p", { class: "muted-note" }, t(lang, "emptyState")),
    );

    const errSec = el(
      "section",
      { class: "panel-box" },
      el("h3", null, `${t(lang, "errorsTitle")} (${errRes.data.items.length})`),
      ...(errRes.data.items.length > 0
        ? errRes.data.items.map((er) =>
            el("pre", { class: "code-block" }, JSON.stringify(er, null, 2)),
          )
        : [el("p", { class: "muted-note" }, t(lang, "emptyState"))]),
    );

    container.append(topGrid, toolsSec, errSec);
    return;
  }

  // tab === "rawlog"
  const logRes = await api.getLog({ limit: 50, lang: toApiLang(lang) });
  const newestEvents = [...events].sort((a, b) => b.seq - a.seq);
  clear(container);
  container.appendChild(el("div", { class: "lab-banner" }, t(lang, "labDisclaimer")));

  const exportBar = el(
    "div",
    { class: "panel-header" },
    el(
      "h3",
      { class: "section-sub", style: "margin:0" },
      `${t(lang, "rawLogTitle")} (${logRes.items.length})`,
    ),
    el(
      "div",
      { class: "panel-actions" },
      el(
        "button",
        {
          type: "button",
          class: "pill-btn",
          onClick: () =>
            downloadBlob(
              "truman-raw-log.json",
              JSON.stringify({ events: newestEvents, log: logRes.items }, null, 2),
              "application/json",
            ),
        },
        t(lang, "exportJson"),
      ),
      el(
        "button",
        {
          type: "button",
          class: "pill-btn",
          onClick: () => {
            const header = "id,ts,category,kind,text";
            const rows = logRes.items.map((r) =>
              [r.id, r.ts, r.category, r.kind, `"${r.text.replace(/"/g, '""')}"`].join(","),
            );
            downloadBlob("truman-raw-log.csv", [header, ...rows].join("\n"), "text/csv");
          },
        },
        t(lang, "exportCsv"),
      ),
    ),
  );

  const logList = el("div", { class: "card-list" });
  for (const item of logRes.items) {
    logList.appendChild(
      el(
        "article",
        { class: "entry-card" },
        el(
          "div",
          { class: "entry-meta" },
          el("span", { class: `tag tag-${item.category}` }, item.category.toUpperCase()),
          el("span", { class: "tag" }, item.kind),
          el("span", { class: "meta-ts" }, `#${item.id} · ${formatDateTime(item.ts)}`),
          el(
            "button",
            { type: "button", class: "link-btn", onClick: () => onInspectContext(item.id) },
            t(lang, "inspectContext"),
          ),
        ),
        el("p", { class: "entry-text" }, item.text),
      ),
    );
  }

  const eventsBox = el(
    "details",
    { class: "panel-box panel-details" },
    el(
      "summary",
      { class: "panel-summary" },
      `${t(lang, "rawEventsTitle")} (${newestEvents.length})`,
    ),
    el("pre", { class: "code-block" }, JSON.stringify(newestEvents, null, 2)),
  );

  container.append(exportBar, logList, eventsBox);
}
