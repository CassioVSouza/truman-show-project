import type { ContextResponse, LogEntry, SearchResponse } from "@truman/contracts";
import type { ViewerApiClient } from "../api/client";
import { t, toApiLang, type UiLang } from "../i18n";
import { clear, el, formatDateTime } from "./dom";

export function renderSearchPanel(
  container: HTMLElement,
  response: SearchResponse | null,
  query: string,
  category: "all" | "life" | "lab",
  lang: UiLang,
  handlers: {
    onFilterCategory: (cat: "all" | "life" | "lab") => void;
    onInspectContext: (entryId: number) => void;
    onClose: () => void;
  },
): void {
  clear(container);
  if (!query.trim()) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  const filterBtn = (cat: "all" | "life" | "lab", label: string) =>
    el(
      "button",
      {
        type: "button",
        class: `pill-btn${category === cat ? " is-active" : ""}`,
        onClick: () => handlers.onFilterCategory(cat),
      },
      label,
    );

  const header = el(
    "div",
    { class: "panel-header" },
    el("h2", null, `${t(lang, "searchResultsTitle")}: “${query}”`),
    el(
      "div",
      { class: "panel-actions" },
      filterBtn("all", t(lang, "filterAll")),
      filterBtn("life", t(lang, "filterLife")),
      filterBtn("lab", t(lang, "filterLab")),
      el(
        "button",
        { type: "button", class: "ghost-btn", onClick: handlers.onClose },
        t(lang, "close"),
      ),
    ),
  );

  const list = el("div", { class: "card-list" });
  if (!response) {
    list.appendChild(el("p", { class: "muted-note" }, t(lang, "loading")));
  } else if (response.results.length === 0) {
    list.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
  } else {
    for (const item of response.results) {
      list.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            el("span", { class: `tag tag-${item.category}` }, item.category.toUpperCase()),
            el("span", { class: "tag" }, item.kind),
            el("span", { class: "meta-ts" }, formatDateTime(item.ts)),
            el(
              "button",
              {
                type: "button",
                class: "link-btn",
                onClick: () => handlers.onInspectContext(item.id),
              },
              t(lang, "inspectContext"),
            ),
          ),
          el("p", { class: "entry-text" }, item.text),
        ),
      );
    }
  }

  container.appendChild(el("div", { class: "search-drawer-inner" }, header, list));
}

function renderEntryMini(
  entry: LogEntry,
  lang: UiLang,
  onSelect: (id: number) => void,
): HTMLElement {
  return el(
    "div",
    { class: "context-node" },
    el(
      "div",
      { class: "entry-meta" },
      el("span", { class: `tag tag-${entry.category}` }, entry.kind),
      el("span", { class: "meta-ts" }, `#${entry.id} · ${formatDateTime(entry.ts)}`),
      el(
        "button",
        { type: "button", class: "link-btn", onClick: () => onSelect(entry.id) },
        t(lang, "inspectContext"),
      ),
    ),
    el("p", { class: "entry-text" }, entry.text),
  );
}

export async function openContextModal(
  modal: HTMLElement,
  api: ViewerApiClient,
  entryId: number,
  lang: UiLang,
): Promise<void> {
  modal.hidden = false;
  clear(modal);
  modal.appendChild(
    el("div", { class: "modal-card" }, el("p", { class: "muted-note" }, t(lang, "loading"))),
  );

  const { data } = await api.getContext(entryId);
  renderContextModalContent(modal, data, lang, (nextId) => {
    void openContextModal(modal, api, nextId, lang);
  });
}

function renderContextModalContent(
  modal: HTMLElement,
  ctx: ContextResponse,
  lang: UiLang,
  onSelectEntry: (id: number) => void,
): void {
  clear(modal);

  const close = () => {
    modal.hidden = true;
    clear(modal);
  };

  const causesEl =
    ctx.causes.length === 0
      ? el("p", { class: "muted-note" }, t(lang, "noCauses"))
      : el(
          "div",
          { class: "context-chain" },
          ...ctx.causes.map((c) => renderEntryMini(c, lang, onSelectEntry)),
        );

  const consequencesEl =
    ctx.consequences.length === 0
      ? el("p", { class: "muted-note" }, t(lang, "noConsequences"))
      : el(
          "div",
          { class: "context-chain" },
          ...ctx.consequences.map((c) => renderEntryMini(c, lang, onSelectEntry)),
        );

  const bodyEl = ctx.body
    ? el(
        "pre",
        { class: "code-block" },
        JSON.stringify(
          {
            emotion_top3: ctx.body.emotion_top3,
            physiology: ctx.body.physiology,
          },
          null,
          2,
        ),
      )
    : el("p", { class: "muted-note" }, "—");

  const card = el(
    "div",
    { class: "modal-card" },
    el(
      "div",
      { class: "panel-header" },
      el("h2", null, `${t(lang, "contextTitle")} #${ctx.entry.id}`),
      el("button", { type: "button", class: "ghost-btn", onClick: close }, t(lang, "close")),
    ),
    el("h3", { class: "section-sub" }, t(lang, "contextCauses")),
    causesEl,
    el("h3", { class: "section-sub" }, t(lang, "contextCurrent")),
    el(
      "div",
      { class: "context-node is-current" },
      el(
        "div",
        { class: "entry-meta" },
        el("span", { class: `tag tag-${ctx.entry.category}` }, ctx.entry.kind),
        el("span", { class: "meta-ts" }, formatDateTime(ctx.entry.ts)),
      ),
      el("p", { class: "entry-text" }, ctx.entry.text),
      Object.keys(ctx.entry.data).length > 0
        ? el("pre", { class: "code-block" }, JSON.stringify(ctx.entry.data, null, 2))
        : null,
    ),
    el("h3", { class: "section-sub" }, t(lang, "contextConsequences")),
    consequencesEl,
    el("h3", { class: "section-sub" }, t(lang, "contextBodyAtTime")),
    bodyEl,
    el("h3", { class: "section-sub" }, t(lang, "contextTraces")),
    el("pre", { class: "code-block" }, JSON.stringify(ctx.trace_refs, null, 2)),
  );

  modal.appendChild(card);
}

export async function runSearch(
  api: ViewerApiClient,
  query: string,
  category: "all" | "life" | "lab",
  lang: UiLang,
): Promise<SearchResponse> {
  const { data } = await api.search({
    q: query,
    category: category === "all" ? undefined : category,
    lang: toApiLang(lang),
    limit: 30,
  });
  return data;
}
