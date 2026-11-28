import type { ViewerApiClient } from "../api/client";
import type { SearchHistoryItem } from "../api/demoData";
import { t, toApiLang, type UiLang } from "../i18n";
import { clear, el, formatDateTime } from "./dom";
import {
  bindTranslation,
  entityFallback,
  kvRowT,
  translatedInline,
  translatedParagraph,
} from "./translatable";

export type LifeTab =
  "live" | "thoughts" | "journal" | "actions" | "memories" | "questions" | "searches";

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

export function searchCard(
  api: ViewerApiClient,
  item: SearchHistoryItem,
  lang: UiLang,
  onInspectContext: (entryId: number) => void,
): HTMLElement {
  const results = el("ul", { class: "search-results" });
  for (const r of item.results) {
    const li = el("li", null);
    // Only http(s) URLs become links; anything else is shown as plain text.
    if (/^https?:\/\//i.test(r.url)) {
      const a = el("a", { class: "link-btn" }, r.title || r.url);
      if (r.title) bindTranslation(a, null, r.title, lang, null);
      a.setAttribute("href", r.url);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      li.appendChild(a);
    } else {
      li.appendChild(
        r.title ? translatedInline(r.title, lang, null) : document.createTextNode(r.url),
      );
    }
    results.appendChild(li);
  }
  const query = translatedParagraph(
    "entry-text",
    item.query,
    lang,
    item.translated ?? null,
    entityFallback(api, "log_entries", item.id),
  );
  return el(
    "article",
    { class: "entry-card" },
    el(
      "div",
      { class: "entry-meta" },
      lang === "en" ? null : query.tag,
      el(
        "span",
        { class: item.ok ? "tag tag-life" : "tag tag-fallback" },
        t(lang, item.ok ? "searchesOk" : "searchesFailed"),
      ),
      el("span", { class: "meta-ts" }, formatDateTime(item.ts)),
      el(
        "button",
        { type: "button", class: "link-btn", onClick: () => onInspectContext(item.id) },
        t(lang, "inspectContext"),
      ),
    ),
    query.p,
    item.results.length > 0
      ? results
      : item.ok
        ? el("p", { class: "muted-note" }, t(lang, "searchesNoResults"))
        : null,
  );
}

async function renderSearchHistory(
  container: HTMLElement,
  api: ViewerApiClient,
  lang: UiLang,
  onInspectContext: (entryId: number) => void,
): Promise<void> {
  const first = await api.getSearches({ limit: 30, lang: toApiLang(lang) });
  clear(container);
  if (first.items.length === 0) {
    container.appendChild(
      el("p", { class: "muted-note" }, t(lang, first.error ? "errorLoad" : "emptyState")),
    );
    return;
  }
  const list = el("div", { class: "card-list" });
  const footer = el("div", { class: "load-more" });
  container.append(list, footer);
  const show = (items: SearchHistoryItem[], next: number | null): void => {
    for (const item of items) list.appendChild(searchCard(api, item, lang, onInspectContext));
    clear(footer);
    if (next === null) return;
    footer.appendChild(
      el(
        "button",
        {
          type: "button",
          class: "link-btn",
          onClick: () => {
            void api
              .getSearches({ before: next, limit: 30, lang: toApiLang(lang) })
              .then((more) => {
                if (more.error) {
                  footer.appendChild(el("p", { class: "muted-note" }, t(lang, "errorLoad")));
                  return;
                }
                show(more.items, more.next_before);
              });
          },
        },
        t(lang, "searchesLoadOlder"),
      ),
    );
  };
  show(first.items, first.next_before);
}

export async function renderLifeTab(
  container: HTMLElement,
  tab: Exclude<LifeTab, "live">,
  api: ViewerApiClient,
  lang: UiLang,
  onInspectContext: (entryId: number) => void,
): Promise<void> {
  clear(container);
  container.appendChild(el("p", { class: "muted-note" }, t(lang, "loading")));

  if (tab === "thoughts") {
    const res = await api.getLog({
      kind: "thought",
      category: "life",
      limit: 50,
      lang: toApiLang(lang),
    });
    clear(container);
    if (res.items.length === 0) {
      container.appendChild(
        el("p", { class: "muted-note" }, t(lang, res.error ? "errorLoad" : "emptyState")),
      );
      return;
    }
    const list = el("div", { class: "card-list" });
    for (const item of res.items) {
      const { p: textP, tag: langTag } = translatedParagraph(
        "entry-text",
        item.text,
        lang,
        item.translated ?? null,
        entityFallback(api, "log_entries", item.id),
      );
      const details = kvGroup([
        kvRowT(t(lang, "intentLabel"), str(item.data["intent"]), lang),
        kvRowT(t(lang, "expectationLabel"), str(item.data["expectation"]), lang),
      ]);
      list.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            langTag,
            el("span", { class: "meta-ts" }, formatDateTime(item.ts)),
            el(
              "button",
              { type: "button", class: "link-btn", onClick: () => onInspectContext(item.id) },
              t(lang, "inspectContext"),
            ),
          ),
          textP,
          details,
        ),
      );
    }
    container.appendChild(list);
    return;
  }

  if (tab === "journal") {
    const { data, error } = await api.getList("journal", { lang: toApiLang(lang), limit: 50 });
    clear(container);
    if (data.items.length === 0) {
      container.appendChild(
        el("p", { class: "muted-note" }, t(lang, error ? "errorLoad" : "emptyState")),
      );
      return;
    }
    const list = el("div", { class: "card-list" });
    for (const item of data.items) {
      const id = Number(item["id"] ?? 0);
      const logEntryId = Number(item["log_entry_id"] ?? item["log_id"] ?? 0);
      const orig = str(item["text"] ?? item["body"] ?? item["content"]);
      const cachedPt =
        str(item["translated"] ?? item["text_pt"] ?? item["translated_text"]) || null;
      const { p: textP, tag: langTag } = translatedParagraph(
        "entry-text",
        orig,
        lang,
        cachedPt,
        entityFallback(api, "journal", id),
      );
      list.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            langTag,
            el("span", { class: "meta-ts" }, formatDateTime(str(item["ts"] ?? item["created_at"]))),
            logEntryId > 0
              ? el(
                  "button",
                  {
                    type: "button",
                    class: "link-btn",
                    onClick: () => onInspectContext(logEntryId),
                  },
                  t(lang, "inspectContext"),
                )
              : null,
          ),
          textP,
        ),
      );
    }
    container.appendChild(list);
    return;
  }

  if (tab === "actions") {
    const [actionsRes, reviewsRes] = await Promise.all([
      api.getLog({ kind: "action", category: "life", limit: 50, lang: toApiLang(lang) }),
      api.getLog({ kind: "outcome_review", category: "life", limit: 50, lang: toApiLang(lang) }),
    ]);
    clear(container);
    const reviewByCause = new Map(
      reviewsRes.items.filter((r) => r.caused_by !== null).map((r) => [r.caused_by!, r]),
    );
    if (actionsRes.items.length === 0) {
      container.appendChild(
        el("p", { class: "muted-note" }, t(lang, actionsRes.error ? "errorLoad" : "emptyState")),
      );
      return;
    }
    const list = el("div", { class: "card-list" });
    for (const item of actionsRes.items) {
      const rev = reviewByCause.get(item.id);
      const actionObj = item.data["action"] as Record<string, unknown> | undefined;
      const actionType = str(actionObj?.["type"] ?? item.data["type"]) || "action";
      const intent = str(actionObj?.["intent"] ?? item.data["intent"]);
      const expectation = str(actionObj?.["expectation"] ?? item.data["expectation"]);
      const outcome = str(item.data["outcome"]) || rev?.text || "";
      const feeling = rev ? str(rev.data["feeling_description"]) : "";
      const details = kvGroup([
        kvRowT(t(lang, "intentLabel"), intent, lang),
        kvRowT(t(lang, "expectationLabel"), expectation, lang),
        kvRowT(
          t(lang, "outcomeLabel"),
          outcome,
          lang,
          !str(item.data["outcome"]) && rev
            ? entityFallback(api, "log_entries", rev.id)
            : undefined,
          !str(item.data["outcome"]) && rev ? (rev.translated ?? null) : null,
        ),
        kvRowT(t(lang, "feelingLabel"), feeling, lang),
      ]);
      const actionText = translatedParagraph(
        "entry-text",
        item.text,
        lang,
        item.translated ?? null,
        entityFallback(api, "log_entries", item.id),
      );
      list.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            el("span", { class: "tag tag-life" }, actionType),
            lang === "en" ? null : actionText.tag,
            el("span", { class: "meta-ts" }, formatDateTime(item.ts)),
            el(
              "button",
              { type: "button", class: "link-btn", onClick: () => onInspectContext(item.id) },
              t(lang, "inspectContext"),
            ),
          ),
          actionText.p,
          details,
        ),
      );
    }
    container.appendChild(list);
    return;
  }

  if (tab === "searches") {
    await renderSearchHistory(container, api, lang, onInspectContext);
    return;
  }

  if (tab === "memories") {
    const { data, error } = await api.getList("memories", { lang: toApiLang(lang), limit: 50 });
    clear(container);
    if (data.items.length === 0) {
      container.appendChild(
        el("p", { class: "muted-note" }, t(lang, error ? "errorLoad" : "emptyState")),
      );
      return;
    }
    const list = el("div", { class: "card-list" });
    for (const item of data.items) {
      const content = str(item["content"] ?? item["text"]);
      const kindTag = str(item["kind"]) || "memory";
      const source = str(item["source"] ?? item["source_url"]);
      const mem = translatedParagraph(
        "entry-text",
        content,
        lang,
        str(item["translated"]) || null,
        entityFallback(api, "memories", Number(item["id"] ?? 0)),
      );
      list.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            el("span", { class: "tag tag-life" }, kindTag),
            lang === "en" ? null : mem.tag,
            el("span", { class: "meta-ts" }, formatDateTime(str(item["ts"] ?? item["created_at"]))),
          ),
          mem.p,
          kvGroup([kvRow(t(lang, "sourceLabel"), source)]),
        ),
      );
    }
    container.appendChild(list);
    return;
  }

  // tab === "questions" (Questions, Ideas, Lessons, Dreams, Self/Beliefs)
  const [ideasRes, lessonsRes, dreamsRes, beliefsRes] = await Promise.all([
    api.getList("ideas", { lang: toApiLang(lang), limit: 20 }),
    api.getLog({ kind: "lesson", category: "life", limit: 20, lang: toApiLang(lang) }),
    api.getList("dreams", { lang: toApiLang(lang), limit: 10 }),
    api.getList("beliefs", { lang: toApiLang(lang), limit: 10 }),
  ]);
  clear(container);

  const grid = el("div", { class: "two-col-grid" });

  // Questions & Ideas
  const qList = el("div", { class: "card-list" });
  const qCol = el(
    "section",
    { class: "panel-box" },
    el("h3", null, `${t(lang, "questionsTitle")} (${ideasRes.data.items.length})`),
  );
  if (ideasRes.data.items.length === 0) {
    qCol.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
  } else {
    for (const item of ideasRes.data.items) {
      const idea = translatedParagraph(
        "entry-text",
        str(item["text"] ?? item["content"]),
        lang,
        str(item["translated"]) || null,
        entityFallback(api, "log_entries", Number(item["id"] ?? 0)),
      );
      qList.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            el("span", { class: "tag" }, str(item["status"] ?? item["kind"] ?? "open")),
            lang === "en" ? null : idea.tag,
            el("span", { class: "meta-ts" }, formatDateTime(str(item["ts"] ?? item["created_at"]))),
          ),
          idea.p,
        ),
      );
    }
    qCol.appendChild(qList);
  }

  // Lessons
  const lList = el("div", { class: "card-list" });
  const lCol = el(
    "section",
    { class: "panel-box" },
    el("h3", null, `${t(lang, "lessonsTitle")} (${lessonsRes.items.length})`),
  );
  if (lessonsRes.items.length === 0) {
    lCol.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
  } else {
    for (const item of lessonsRes.items) {
      const lesson = translatedParagraph(
        "entry-text",
        item.text,
        lang,
        item.translated ?? null,
        entityFallback(api, "log_entries", item.id),
      );
      lList.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            el("span", { class: "tag tag-life" }, t(lang, "lessonLabel")),
            lang === "en" ? null : lesson.tag,
            el("span", { class: "meta-ts" }, formatDateTime(item.ts)),
            el(
              "button",
              { type: "button", class: "link-btn", onClick: () => onInspectContext(item.id) },
              t(lang, "inspectContext"),
            ),
          ),
          lesson.p,
        ),
      );
    }
    lCol.appendChild(lList);
  }

  // Dreams
  const dList = el("div", { class: "card-list" });
  const dCol = el(
    "section",
    { class: "panel-box" },
    el("h3", null, `${t(lang, "dreamsTitle")} (${dreamsRes.data.items.length})`),
  );
  if (dreamsRes.data.items.length === 0) {
    dCol.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
  } else {
    for (const item of dreamsRes.data.items) {
      const spawned = str(item["spawned_question"]);
      const dream = translatedParagraph(
        "entry-text",
        str(item["text"] ?? item["content"]),
        lang,
        str(item["translated"]) || null,
        entityFallback(api, "dreams", Number(item["id"] ?? 0)),
      );
      dList.appendChild(
        el(
          "article",
          { class: "entry-card" },
          lang === "en" ? null : el("div", { class: "entry-meta" }, dream.tag),
          dream.p,
          spawned
            ? el(
                "p",
                { class: "entry-sub" },
                translatedInline(spawned, lang, null, undefined, "→ "),
              )
            : null,
        ),
      );
    }
    dCol.appendChild(dList);
  }

  // Self & Beliefs
  const bList = el("div", { class: "card-list" });
  const bCol = el(
    "section",
    { class: "panel-box" },
    el("h3", null, `${t(lang, "beliefsTitle")} (${beliefsRes.data.items.length})`),
  );
  if (beliefsRes.data.items.length === 0) {
    bCol.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
  } else {
    for (const item of beliefsRes.data.items) {
      const conf = Number(item["confidence"] ?? 0);
      const belief = translatedParagraph(
        "entry-text",
        str(item["hypothesis"] ?? item["text"]),
        lang,
        str(item["translated"]) || null,
        entityFallback(api, "beliefs", Number(item["id"] ?? 0)),
      );
      const evidence = str(item["evidence"]);
      bList.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            el(
              "span",
              { class: "tag" },
              `${t(lang, "confidenceLabel")}: ${Math.round(conf * 100)}%`,
            ),
            lang === "en" ? null : belief.tag,
          ),
          belief.p,
          evidence ? el("p", { class: "entry-sub" }, translatedInline(evidence, lang, null)) : null,
        ),
      );
    }
    bCol.appendChild(bList);
  }

  grid.append(qCol, lCol, dCol, bCol);
  container.appendChild(grid);
}
