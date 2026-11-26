// LlmClient: provider order, JSON + zod validation with ONE repair retry, fallback on rate limit / quota /
// refusal / outage, and a trace row for every call. A refusal is logged and the next provider is tried;
// the reply is never rewritten or softened.
import type { z } from "zod";
import { repairMessages, type PromptMessage } from "../prompts";
import {
  LLMError,
  type LlmProvider,
  type LlmRole,
  type LlmTraceRow,
  type ProviderUsage,
  type RawRequest,
} from "./types";

export interface GenerateRequest<T> {
  role: LlmRole;
  system: string;
  messages: PromptMessage[];
  schema: z.ZodType<T>;
  temperature: number;
  maxOutputTokens: number;
}

export interface GenerateResult<T> {
  data: T;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  attempts: number;
}

export interface ClientOptions {
  /** Provider ids already out of quota today (the governor persists this). */
  exhausted?: Iterable<string>;
  /** Hard cap on provider calls in one tick (each is a subrequest on the Workers Free plan). */
  maxCalls?: number;
  clock?: () => number;
}

/** Pulls the JSON object out of a reply, tolerating code fences and stray text around it. */
export function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    /* fall through */
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  const candidate = fenced?.[1] ?? t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}

export class LlmClient {
  traces: LlmTraceRow[] = [];
  usage = new Map<string, ProviderUsage>();
  exhausted: Set<string>;
  calls = 0;
  /** Refusals seen this tick (logged by the pipeline as errors, never rewritten). */
  refusals: Array<{ provider: string; reason: string }> = [];
  private maxCalls: number;
  private clock: () => number;

  constructor(
    private providers: LlmProvider[],
    opts: ClientOptions = {},
  ) {
    this.exhausted = new Set(opts.exhausted ?? []);
    this.maxCalls = opts.maxCalls ?? 8;
    this.clock = opts.clock ?? (() => Date.now());
  }

  /** True when no provider is left to try (all out of quota today, or none configured). */
  get allOut(): boolean {
    return this.providers.every((p) => this.exhausted.has(p.id));
  }

  private bump(id: string, f: (u: ProviderUsage) => void): void {
    const u = this.usage.get(id) ?? { calls: 0, tokens_in: 0, tokens_out: 0, errors: 0 };
    f(u);
    this.usage.set(id, u);
  }

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    const failures: string[] = [];
    for (const p of this.providers) {
      if (this.exhausted.has(p.id)) continue;
      let messages = req.messages;
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (this.calls >= this.maxCalls) {
          failures.push(`${p.id}: per-tick call cap reached`);
          throw new LLMError("Unavailable", failures.join("; "));
        }
        this.calls++;
        const raw: RawRequest = {
          role: req.role,
          system: req.system,
          messages,
          temperature: req.temperature,
          maxOutputTokens: req.maxOutputTokens,
        };
        const t0 = this.clock();
        const trace = (over: Partial<LlmTraceRow>): void => {
          this.traces.push({
            role: req.role,
            provider: p.id,
            model: p.model,
            system_prompt: req.system,
            messages,
            response: null,
            tokens_in: 0,
            tokens_out: 0,
            latency_ms: Math.max(0, Math.round(this.clock() - t0)),
            finish_reason: null,
            ok: false,
            ...over,
          });
        };
        let completion;
        try {
          completion = await p.complete(raw);
        } catch (e) {
          const err =
            e instanceof LLMError ? e : new LLMError("Unavailable", String(e).slice(0, 160));
          this.bump(p.id, (u) => {
            u.calls++;
            u.errors++;
          });
          trace({
            response: err.detail.raw ?? err.message,
            finish_reason: err.detail.finish_reason ?? err.kind,
          });
          if (err.kind === "QuotaExhausted") this.exhausted.add(p.id);
          if (err.kind === "Refused") this.refusals.push({ provider: p.id, reason: err.message });
          failures.push(`${p.id}: ${err.kind}`);
          break; // next provider
        }
        this.bump(p.id, (u) => {
          u.calls++;
          u.tokens_in += completion.tokens_in;
          u.tokens_out += completion.tokens_out;
        });
        let problem: string;
        try {
          const parsed = req.schema.safeParse(extractJson(completion.text));
          if (parsed.success) {
            trace({
              response: completion.text,
              tokens_in: completion.tokens_in,
              tokens_out: completion.tokens_out,
              finish_reason: completion.finish_reason,
              ok: true,
            });
            return {
              data: parsed.data,
              provider: p.id,
              model: completion.model,
              tokens_in: completion.tokens_in,
              tokens_out: completion.tokens_out,
              attempts: this.calls,
            };
          }
          problem = parsed.error.issues
            .slice(0, 4)
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("; ");
        } catch {
          problem = "the reply was not valid JSON";
        }
        this.bump(p.id, (u) => u.errors++);
        trace({
          response: completion.text,
          tokens_in: completion.tokens_in,
          tokens_out: completion.tokens_out,
          finish_reason: "InvalidJson",
        });
        if (attempt === 1) {
          messages = repairMessages(req.messages, completion.text, problem);
          continue; // one repair retry on the same provider
        }
        failures.push(`${p.id}: InvalidJson`);
      }
    }
    throw new LLMError(
      "Unavailable",
      `all providers failed (${failures.join("; ") || "none available"})`,
    );
  }
}
