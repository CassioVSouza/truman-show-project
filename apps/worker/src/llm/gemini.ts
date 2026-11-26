// Gemini adapter (generateContent, JSON mode). The key travels in a header, never in the URL, and never in an error.
import { geminiBody } from "../prompts";
import {
  LLMError,
  type FetchLike,
  type LlmProvider,
  type RawCompletion,
  type RawRequest,
} from "./types";

export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite"; // config: check current free-tier models (doc 05)
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const REFUSAL_FINISH = new Set([
  "SAFETY",
  "PROHIBITED_CONTENT",
  "BLOCKLIST",
  "SPII",
  "RECITATION",
  "IMAGE_SAFETY",
]);

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string; status?: string };
}

export class GeminiProvider implements LlmProvider {
  readonly id = "gemini";
  constructor(
    private apiKey: string,
    readonly model: string = GEMINI_DEFAULT_MODEL,
    private fetchFn: FetchLike = (u, i) => fetch(u, i),
    private timeoutMs = 25000,
  ) {}

  async complete(req: RawRequest): Promise<RawCompletion> {
    let res: Response;
    try {
      res = await this.fetchFn(`${BASE}/${this.model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(geminiBody(req)),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new LLMError("Unavailable", `gemini network: ${shorten(e)}`);
    }
    let body: GeminiResponse = {};
    try {
      body = (await res.json()) as GeminiResponse;
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) throw httpError(res.status, body.error?.message ?? "", body.error?.status);
    const block = body.promptFeedback?.blockReason;
    if (block)
      throw new LLMError("Refused", `gemini blocked the prompt: ${block}`, {
        finish_reason: block,
      });
    const cand = body.candidates?.[0];
    const finish = cand?.finishReason ?? null;
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (finish && REFUSAL_FINISH.has(finish))
      throw new LLMError("Refused", `gemini refused: ${finish}`, {
        finish_reason: finish,
        raw: text,
      });
    if (!text)
      throw new LLMError("Unavailable", `gemini returned no text (${finish ?? "no finish"})`);
    return {
      text,
      tokens_in: body.usageMetadata?.promptTokenCount ?? 0,
      tokens_out: body.usageMetadata?.candidatesTokenCount ?? 0,
      finish_reason: finish,
      model: this.model,
    };
  }
}

const shorten = (e: unknown): string => (e instanceof Error ? e.message : String(e)).slice(0, 160);

/** Shared HTTP status mapping. A daily quota means the provider is out for the day; a per-minute limit is transient. */
export function httpError(status: number, message: string, code?: string): LLMError {
  const m = message.toLowerCase();
  if (status === 429 || code === "RESOURCE_EXHAUSTED") {
    const daily =
      /per day|daily|quota exceeded for quota metric.*day|tokens per day|requests per day/.test(m);
    return new LLMError(
      daily ? "QuotaExhausted" : "RateLimited",
      `http ${status}: ${message.slice(0, 160)}`,
      { status },
    );
  }
  return new LLMError("Unavailable", `http ${status}: ${message.slice(0, 160)}`, { status });
}
