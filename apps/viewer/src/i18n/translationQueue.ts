import { translateDynamic, type TranslatedText, type UiLang } from "./index";

/**
 * Rate-aware translation queue for Resident text (presentation only).
 *
 * - dedupes identical texts while a translation is in flight (finished ones hit the
 *   translateDynamic memory cache),
 * - runs at most `concurrency` jobs at once,
 * - keeps server fallback calls under the Worker's translate limit (20/min/IP) with a sliding
 *   window, leaving headroom for other viewers behind the same address.
 * Failures are never cached, so a retry can succeed later.
 */
export interface TranslationQueueOptions {
  concurrency?: number;
  serverPerMinute?: number;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
  translate?: typeof translateDynamic;
}

export interface TranslationRequest {
  original: string;
  lang: UiLang;
  serverFallback?: () => Promise<string | null>;
  /** Checked when the job reaches the front; inactive jobs (closed tab, language switched) are skipped. */
  isActive?: () => boolean;
}

const WINDOW_MS = 60_000;

export class TranslationQueue {
  private readonly concurrency: number;
  private readonly serverPerMinute: number;
  private readonly now: () => number;
  private readonly wait: (ms: number) => Promise<void>;
  private readonly translate: typeof translateDynamic;
  private readonly inflight = new Map<string, Promise<TranslatedText>>();
  private readonly pending: Array<() => void> = [];
  private readonly serverCalls: number[] = [];
  private running = 0;

  constructor(opts: TranslationQueueOptions = {}) {
    this.concurrency = Math.max(1, opts.concurrency ?? 2);
    this.serverPerMinute = Math.max(1, opts.serverPerMinute ?? 15);
    this.now = opts.now ?? (() => Date.now());
    this.wait = opts.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.translate = opts.translate ?? translateDynamic;
  }

  get queued(): number {
    return this.pending.length;
  }

  request(req: TranslationRequest): Promise<TranslatedText> {
    const original = req.original;
    if (req.lang === "en" || !original.trim()) {
      return Promise.resolve({ text: original, lang: "en", isFallback: false });
    }
    const key = `${req.lang}:${original}`;
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const job = this.enqueue(req).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, job);
    return job;
  }

  private enqueue(req: TranslationRequest): Promise<TranslatedText> {
    return new Promise((resolve) => {
      const run = (): void => {
        this.running++;
        const done = (res: TranslatedText): void => {
          this.running--;
          resolve(res);
          this.pump();
        };
        if (req.isActive && !req.isActive()) {
          done({ text: req.original, lang: "en", isFallback: true });
          return;
        }
        const gated = req.serverFallback ? this.gate(req.serverFallback) : undefined;
        this.translate(req.original, req.lang, gated).then(done, () =>
          done({ text: req.original, lang: "en", isFallback: true }),
        );
      };
      this.pending.push(run);
      this.pump();
    });
  }

  private pump(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      this.pending.shift()!();
    }
  }

  /** Wraps a server call so no more than `serverPerMinute` start inside any 60 s window. */
  private gate(call: () => Promise<string | null>): () => Promise<string | null> {
    return async () => {
      for (;;) {
        const t = this.now();
        while (this.serverCalls.length > 0 && t - this.serverCalls[0]! >= WINDOW_MS) {
          this.serverCalls.shift();
        }
        if (this.serverCalls.length < this.serverPerMinute) break;
        await this.wait(WINDOW_MS - (t - this.serverCalls[0]!) + 50);
      }
      this.serverCalls.push(this.now());
      return call();
    };
  }
}

export const sharedTranslationQueue = new TranslationQueue();

/** Backoff for retrying a failed translation: 20 s, 40 s, 80 s, capped at 5 min. */
export function retryDelayMs(attempt: number): number {
  return Math.min(20_000 * 2 ** Math.max(0, attempt), 300_000);
}
