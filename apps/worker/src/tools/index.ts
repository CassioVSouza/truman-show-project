// Tools port. Wave 1 ships stubs only: web search (Tavily, Wikipedia), page reader (Jina, direct fetch) and the
// fetch guard arrive in a later wave. Real results will arrive as untrusted text (shown wrapped, never as
// instructions, never filtered).
export interface ToolOutcome {
  ok: boolean;
  text: string;
  source_url?: string;
  bytes: number;
}

export interface Tools {
  webSearch(query: string): Promise<ToolOutcome>;
  readPage(url: string): Promise<ToolOutcome>;
}

const NOTHING = "The terminal gives no answer.";

/** Honest stub: no network, no content. */
export const stubTools: Tools = {
  async webSearch() {
    return { ok: false, text: NOTHING, bytes: 0 };
  },
  async readPage(url) {
    return { ok: false, text: NOTHING, source_url: url, bytes: 0 };
  },
};
