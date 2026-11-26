import type { PromptMessage } from "../prompts";

export type LLMErrorKind =
  "RateLimited" | "QuotaExhausted" | "InvalidJson" | "Refused" | "Unavailable";

export class LLMError extends Error {
  constructor(
    public kind: LLMErrorKind,
    message: string,
    public detail: { status?: number; raw?: string; finish_reason?: string } = {},
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export type LlmRole = "resident" | "interpreter" | "dream" | "translate";

/** What a provider receives: already-built prompt text. Providers never build prompts. */
export interface RawRequest {
  role: LlmRole;
  system: string;
  messages: PromptMessage[];
  temperature: number;
  maxOutputTokens: number;
}

export interface RawCompletion {
  text: string;
  tokens_in: number;
  tokens_out: number;
  finish_reason: string | null;
  model: string;
}

/** A provider returns text or throws LLMError. JSON parsing, zod and repair live in LlmClient. */
export interface LlmProvider {
  readonly id: string;
  readonly model: string;
  complete(req: RawRequest): Promise<RawCompletion>;
}

/** One row for `llm_traces` (written for EVERY attempt, including failures and refusals). */
export interface LlmTraceRow {
  role: LlmRole;
  provider: string;
  model: string;
  system_prompt: string;
  messages: PromptMessage[];
  response: string | null;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  finish_reason: string | null;
  ok: boolean;
}

export interface ProviderUsage {
  calls: number;
  tokens_in: number;
  tokens_out: number;
  errors: number;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
