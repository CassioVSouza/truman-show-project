// Workers AI fallback adapter (free-tier Cloudflare binding `env.AI`). Used only when Gemini and Groq are absent or fail.
import { workersAiBody } from "../prompts";
import { LLMError, type LlmProvider, type RawCompletion, type RawRequest } from "./types";

export const WORKERS_AI_DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

export interface WorkersAiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

interface WorkersAiResponse {
  response?: unknown;
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class WorkersAiProvider implements LlmProvider {
  readonly id = "workers-ai";
  constructor(
    private ai: WorkersAiBinding,
    readonly model: string = WORKERS_AI_DEFAULT_MODEL,
  ) {}

  async complete(req: RawRequest): Promise<RawCompletion> {
    let raw: unknown;
    try {
      raw = await this.ai.run(this.model, workersAiBody(req));
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 160);
      if (/quota|daily|neurons|limit/i.test(msg)) {
        throw new LLMError("QuotaExhausted", `workers-ai quota: ${msg}`);
      }
      if (/rate|429|too many/i.test(msg)) {
        throw new LLMError("RateLimited", `workers-ai rate limit: ${msg}`);
      }
      throw new LLMError("Unavailable", `workers-ai error: ${msg}`);
    }
    const body = (raw ?? {}) as WorkersAiResponse;
    let text = "";
    let finish: string | null = null;
    if (typeof body.response === "string") {
      text = body.response;
    } else if (body.response && typeof body.response === "object") {
      text = JSON.stringify(body.response);
    } else if (body.choices?.[0]?.message?.content) {
      text = body.choices[0].message.content;
      finish = body.choices[0].finish_reason ?? null;
    }
    if (!text) {
      throw new LLMError("Unavailable", "workers-ai returned no text");
    }
    return {
      text,
      tokens_in: body.usage?.prompt_tokens ?? 0,
      tokens_out: body.usage?.completion_tokens ?? 0,
      finish_reason: finish,
      model: this.model,
    };
  }
}
