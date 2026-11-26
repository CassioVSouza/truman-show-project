// Groq adapter (OpenAI-compatible chat completions, JSON mode). Free tier is small (doc 05): small prompts only.
import { chatBody } from "../prompts";
import { httpError } from "./gemini";
import {
  LLMError,
  type FetchLike,
  type LlmProvider,
  type RawCompletion,
  type RawRequest,
} from "./types";

export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-20b"; // doc 05: Llama 3.x retired; keep model ids in config
const URL = "https://api.groq.com/openai/v1/chat/completions";

interface ChatResponse {
  choices?: Array<{
    message?: { content?: string | null; refusal?: string | null };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string };
}

export class GroqProvider implements LlmProvider {
  readonly id = "groq";
  constructor(
    private apiKey: string,
    readonly model: string = GROQ_DEFAULT_MODEL,
    private fetchFn: FetchLike = (u, i) => fetch(u, i),
    private timeoutMs = 25000,
  ) {}

  async complete(req: RawRequest): Promise<RawCompletion> {
    let res: Response;
    try {
      res = await this.fetchFn(URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(chatBody(this.model, req)),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new LLMError(
        "Unavailable",
        `groq network: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`,
      );
    }
    let body: ChatResponse = {};
    try {
      body = (await res.json()) as ChatResponse;
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) throw httpError(res.status, body.error?.message ?? "", body.error?.code);
    const choice = body.choices?.[0];
    const finish = choice?.finish_reason ?? null;
    const text = choice?.message?.content ?? "";
    if (choice?.message?.refusal || finish === "content_filter")
      throw new LLMError("Refused", `groq refused (${finish ?? "refusal"})`, {
        finish_reason: finish ?? "refusal",
        raw: choice?.message?.refusal ?? text,
      });
    if (!text)
      throw new LLMError("Unavailable", `groq returned no text (${finish ?? "no finish"})`);
    return {
      text,
      tokens_in: body.usage?.prompt_tokens ?? 0,
      tokens_out: body.usage?.completion_tokens ?? 0,
      finish_reason: finish,
      model: this.model,
    };
  }
}
