import type { ViewerApiClient } from "../api/client";
import { t, toApiLang, translateDynamic, type UiLang } from "../i18n";
import { clear, el, formatDateTime } from "./dom";

export type LifeTab = "live" | "thoughts" | "journal" | "actions" | "memories" | "questions";

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function attachTranslation(
  textEl: HTMLElement,
  badgeEl: HTMLElement,
  original: string,
  lang: UiLang,
  cachedPt: string | null,
  serverFallback?: () => Promise<string | null>,
): void {
  if (lang === "en") return;
  if (cachedPt && cachedPt.trim()) {
    textEl.textContent = cachedPt;
    badgeEl.textContent = t(lang, "translatedTag");
    badgeEl.className = "tag tag-lang";
    return;
  }
  void translateDynamic(original, lang, serverFallback).then((res) => {
    textEl.textContent = res.text;
    badgeEl.textContent = res.isFallback ? t(lang, "enFallbackTag") : t(lang, "translatedTag");
    badgeEl.className = res.isFallback ? "tag tag-fallback" : "tag tag-lang";
  });
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
    const res = await api.getLog({ kind: "thought", category: "life", limit: 40 });
    clear(container);
    container.appendChild(el("h2", { class: "view-title" }, t(lang, "navThoughts")));
    if (res.items.length === 0) {
      container.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
      return;
    }
    const list = el("div", { class: "card-list" });
    for (const item of res.items) {
      const textP = el("p", { class: "entry-text" }, item.text);
      const langTag = el("span", { class: "tag" }, lang === "en" ? "EN" : "…");
      attachTranslation(textP, langTag, item.text, lang, null, () =>
        api.translateEntity("log_entries", item.id),
      );
      const intent = str(item.data["intent"]);
      const expectation = str(item.data["expectation"]);
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
          intent
            ? el(
                "p",
                { class: "entry-sub" },
                el("strong", null, `${t(lang, "intentLabel")}: `),
                intent,
              )
            : null,
          expectation
            ? el(
                "p",
                { class: "entry-sub" },
                el("strong", null, `${t(lang, "expectationLabel")}: `),
                expectation,
              )
            : null,
        ),
      );
    }
    container.appendChild(list);
    return;
  }

  if (tab === "journal") {
    const { data } = await api.getList("journal", { lang: toApiLang(lang), limit: 30 });
    clear(container);
    container.appendChild(el("h2", { class: "view-title" }, t(lang, "navJournal")));
    if (data.items.length === 0) {
      container.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
      return;
    }
    const list = el("div", { class: "card-list" });
    for (const item of data.items) {
      const id = Number(item["id"] ?? 0);
      const logEntryId = Number(item["log_entry_id"] ?? item["log_id"] ?? 0);
      const orig = str(item["text"] ?? item["body"] ?? item["content"]);
      const cachedPt = str(item["text_pt"] ?? item["translated_text"]) || null;
      const textP = el("p", { class: "entry-text" }, orig);
      const langTag = el("span", { class: "tag" }, lang === "en" ? "EN" : "…");
      attachTranslation(textP, langTag, orig, lang, cachedPt, () =>
        id ? api.translateEntity("journal", id) : Promise.resolve(null),
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
      api.getLog({ kind: "action", category: "life", limit: 40 }),
      api.getLog({ kind: "outcome_review", category: "life", limit: 40 }),
    ]);
    clear(container);
    container.appendChild(el("h2", { class: "view-title" }, t(lang, "navActions")));
    const reviewByCause = new Map(
      reviewsRes.items.filter((r) => r.caused_by !== null).map((r) => [r.caused_by!, r]),
    );
    if (actionsRes.items.length === 0) {
      container.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
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
      list.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            el("span", { class: "tag tag-life" }, actionType),
            el("span", { class: "meta-ts" }, formatDateTime(item.ts)),
            el(
              "button",
              { type: "button", class: "link-btn", onClick: () => onInspectContext(item.id) },
              t(lang, "inspectContext"),
            ),
          ),
          el("p", { class: "entry-text" }, item.text),
          intent
            ? el(
                "p",
                { class: "entry-sub" },
                el("strong", null, `${t(lang, "intentLabel")}: `),
                intent,
              )
            : null,
          expectation
            ? el(
                "p",
                { class: "entry-sub" },
                el("strong", null, `${t(lang, "expectationLabel")}: `),
                expectation,
              )
            : null,
          outcome
            ? el(
                "p",
                { class: "entry-sub" },
                el("strong", null, `${t(lang, "outcomeLabel")}: `),
                outcome,
              )
            : null,
          feeling
            ? el(
                "p",
                { class: "entry-sub" },
                el("strong", null, `${t(lang, "feelingLabel")}: `),
                feeling,
              )
            : null,
        ),
      );
    }
    container.appendChild(list);
    return;
  }

  if (tab === "memories") {
    const { data } = await api.getList("memories", { lang: toApiLang(lang), limit: 30 });
    clear(container);
    container.appendChild(el("h2", { class: "view-title" }, t(lang, "navMemories")));
    if (data.items.length === 0) {
      container.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
      return;
    }
    const list = el("div", { class: "card-list" });
    for (const item of data.items) {
      const content = str(item["content"] ?? item["text"]);
      const source = str(item["source"] ?? item["source_url"]);
      list.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            el("span", { class: "tag tag-life" }, "memory"),
            el("span", { class: "meta-ts" }, formatDateTime(str(item["ts"] ?? item["created_at"]))),
          ),
          el("p", { class: "entry-text" }, content),
          source
            ? el(
                "p",
                { class: "entry-sub" },
                el("strong", null, `${t(lang, "sourceLabel")}: `),
                source,
              )
            : null,
        ),
      );
    }
    container.appendChild(list);
    return;
  }

  // tab === "questions" (Questions, Ideas, Lessons, Dreams, Self/Beliefs)
  const [ideasRes, lessonsRes, dreamsRes, beliefsRes] = await Promise.all([
    api.getList("ideas", { lang: toApiLang(lang), limit: 20 }),
    api.getLog({ kind: "lesson", category: "life", limit: 20 }),
    api.getList("dreams", { lang: toApiLang(lang), limit: 10 }),
    api.getList("beliefs", { lang: toApiLang(lang), limit: 10 }),
  ]);
  clear(container);
  container.appendChild(el("h2", { class: "view-title" }, t(lang, "navQuestionsLessons")));

  const grid = el("div", { class: "two-col-grid" });

  // Questions & Ideas
  const qCol = el("section", { class: "panel-box" }, el("h3", null, t(lang, "questionsTitle")));
  if (ideasRes.data.items.length === 0) {
    qCol.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
  } else {
    for (const item of ideasRes.data.items) {
      qCol.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            el("span", { class: "tag" }, str(item["status"] ?? "open")),
            el("span", { class: "meta-ts" }, formatDateTime(str(item["ts"] ?? item["created_at"]))),
          ),
          el("p", { class: "entry-text" }, str(item["text"] ?? item["content"])),
        ),
      );
    }
  }

  // Lessons
  const lCol = el("section", { class: "panel-box" }, el("h3", null, t(lang, "lessonsTitle")));
  if (lessonsRes.items.length === 0) {
    lCol.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
  } else {
    for (const item of lessonsRes.items) {
      lCol.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el(
            "div",
            { class: "entry-meta" },
            el("span", { class: "tag tag-life" }, t(lang, "lessonLabel")),
            el("span", { class: "meta-ts" }, formatDateTime(item.ts)),
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
  }

  // Dreams
  const dCol = el("section", { class: "panel-box" }, el("h3", null, t(lang, "dreamsTitle")));
  if (dreamsRes.data.items.length === 0) {
    dCol.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
  } else {
    for (const item of dreamsRes.data.items) {
      const spawned = str(item["spawned_question"]);
      dCol.appendChild(
        el(
          "article",
          { class: "entry-card" },
          el("p", { class: "entry-text" }, str(item["text"] ?? item["content"])),
          spawned ? el("p", { class: "entry-sub" }, `→ ${spawned}`) : null,
        ),
      );
    }
  }

  // Self & Beliefs
  const bCol = el("section", { class: "panel-box" }, el("h3", null, t(lang, "beliefsTitle")));
  if (beliefsRes.data.items.length === 0) {
    bCol.appendChild(el("p", { class: "muted-note" }, t(lang, "emptyState")));
  } else {
    for (const item of beliefsRes.data.items) {
      const conf = Number(item["confidence"] ?? 0);
      bCol.appendChild(
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
          ),
          el("p", { class: "entry-text" }, str(item["hypothesis"] ?? item["text"])),
          str(item["evidence"]) ? el("p", { class: "entry-sub" }, str(item["evidence"])) : null,
        ),
      );
    }
  }

  grid.append(qCol, lCol, dCol, bCol);
  container.appendChild(grid);
}
