import type { ContextResponse, LogEntry, SearchResponse } from "@truman/contracts";
import type { ViewerApiClient } from "../api/client";
import { t, toApiLang, type UiLang } from "../i18n";
import { clear, el, formatDateTime } from "./dom";

export interface SearchPaletteHandlers {
  onSubmitQuery: (query: string) => void;
  onFilterCategory: (cat: "all" | "life" | "lab") => void;
  onInspectContext: (entryId: number) => void;
  onClose: () => void;
}

export function renderSearchPalette(
  backdrop: HTMLElement,
  isOpen: boolean,
  response: SearchResponse | null,
  query: string,
  category: "all" | "life" | "lab",
  lang: UiLang,
  handlers: SearchPaletteHandlers,
  focusInput = false,
): void {
  backdrop.hidden = !isOpen;
  if (!isOpen) {
    clear(backdrop);
    return;
  }
  clear(backdrop);

  const input = el("input", {
    type: "search",
    class: "palette-input",
    placeholder: t(lang, "searchPlaceholder"),
    value: query,
    "aria-label": t(lang, "searchButton"),
  });

  const form = el(
    "form",
    {
      class: "palette-form",
      onSubmit: (e) => {
        e.preventDefault();
        handlers.onSubmitQuery(input.value.trim());
      },
    },
    el("span", { class: "palette-icon" }, "⌕"),
    input,
    el("button", { type: "submit", class: "pill-btn" }, t(lang, "searchButton")),
    el(
      "button",
      {
        type: "button",
        class: "tab-popup-close",
        title: t(lang, "close"),
        "aria-label": t(lang, "close"),
        onClick: handlers.onClose,
      },
      "×",
    ),
  );

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

  const filtersRow = el(
    "div",
    { class: "palette-filters" },
    el(
      "div",
      { class: "panel-actions" },
      filterBtn("all", t(lang, "filterAll")),
      filterBtn("life", t(lang, "filterLife")),
      filterBtn("lab", t(lang, "filterLab")),
    ),
    el("span", { class: "palette-hint" }, el("kbd", null, "Esc")),
  );

  const resultsWrap = el("div", { class: "palette-results" });
  if (!query.trim()) {
    resultsWrap.appendChild(el("p", { class: "muted-note" }, t(lang, "searchPaletteEmpty")));
  } else if (!response) {
    resultsWrap.appendChild(el("p", { class: "muted-note" }, t(lang, "loading")));
  } else if (response.results.length === 0) {
    resultsWrap.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
  } else {
    const list = el("div", { class: "card-list" });
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
            el("span", { class: "meta-ts tabular-num" }, formatDateTime(item.ts)),
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
    resultsWrap.appendChild(list);
  }

  backdrop.appendChild(
    el("div", { class: "search-palette-card", role: "dialog" }, form, filtersRow, resultsWrap),
  );

  if (focusInput) {
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }
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
      el("span", { class: "meta-ts tabular-num" }, `#${entry.id} · ${formatDateTime(entry.ts)}`),
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
  const loading = el(
    "div",
    { class: "modal-card" },
    el("p", { class: "muted-note" }, t(lang, "loading")),
  );
  modal.appendChild(loading);

  const { data } = await api.getContext(entryId);
  if (modal.hidden || !modal.contains(loading)) return;
  if (!data) {
    clear(loading);
    loading.append(
      el("p", { class: "muted-note" }, t(lang, "contextUnavailable")),
      el(
        "button",
        {
          type: "button",
          class: "ghost-btn",
          onClick: () => {
            modal.hidden = true;
          },
        },
        t(lang, "close"),
      ),
    );
    return;
  }
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
        el("span", { class: "meta-ts tabular-num" }, formatDateTime(ctx.entry.ts)),
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
