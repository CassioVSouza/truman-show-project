const TOKEN_KEY = "truman.viewerToken";
export const BEAT_INTERVAL_MS = 60_000;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export interface TokenStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Random per-browser token, kept in storage; falls back to a per-session one. */
export function getViewerToken(store?: TokenStore | null): string {
  try {
    const existing = store?.getItem(TOKEN_KEY);
    if (existing && TOKEN_RE.test(existing)) return existing;
  } catch {
    /* storage blocked */
  }
  const token = crypto.randomUUID().replace(/-/g, "");
  try {
    store?.setItem(TOKEN_KEY, token);
  } catch {
    /* storage blocked */
  }
  return token;
}

export interface ViewerBeatDeps {
  apiBase: string;
  token: string;
  fetchFn?: typeof fetch;
  isVisible: () => boolean;
  onCount: (n: number) => void;
  now?: () => number;
}

/** Sends heartbeats; errors are silent, retry-after on 429 is honoured. */
export class ViewerBeat {
  private pausedUntil = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(private readonly d: ViewerBeatDeps) {}

  async beat(): Promise<void> {
    if (!this.d.apiBase || !this.d.isVisible()) return;
    const now = (this.d.now ?? Date.now)();
    if (now < this.pausedUntil) return;
    try {
      const res = await (this.d.fetchFn ?? fetch)(`${this.d.apiBase}/api/viewers/beat`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: this.d.token,
      });
      if (res.status === 429) {
        const secs = Number(res.headers.get("retry-after"));
        this.pausedUntil =
          now + (Number.isFinite(secs) && secs > 0 ? secs * 1000 : BEAT_INTERVAL_MS);
        return;
      }
      if (!res.ok) return;
      const body = (await res.json()) as { viewers?: unknown };
      if (typeof body.viewers === "number" && body.viewers >= 0) {
        this.d.onCount(Math.floor(body.viewers));
      }
    } catch {
      /* ignore silently */
    }
  }

  start(): void {
    if (!this.d.apiBase || this.timer) return;
    void this.beat();
    this.timer = setInterval(() => void this.beat(), BEAT_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
