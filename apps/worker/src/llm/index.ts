import type { Env } from "../env";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { WorkersAiProvider } from "./workers-ai";
import type { LlmProvider } from "./types";

export { LlmClient, extractJson } from "./client";
export type { GenerateRequest, GenerateResult, ClientOptions } from "./client";
export { GeminiProvider, GEMINI_DEFAULT_MODEL } from "./gemini";
export { GroqProvider, GROQ_DEFAULT_MODEL } from "./groq";
export { WorkersAiProvider, WORKERS_AI_DEFAULT_MODEL } from "./workers-ai";
export type { WorkersAiBinding } from "./workers-ai";
export { FakeProvider } from "./fake";
export type { FakeReply } from "./fake";
export { LLMError } from "./types";
export type {
  FetchLike,
  LLMErrorKind,
  LlmProvider,
  LlmRole,
  LlmTraceRow,
  ProviderUsage,
  RawCompletion,
  RawRequest,
} from "./types";

/** Provider order from config: Gemini first, Groq second, Workers AI fallback if bound. Keys come only from env. */
export function providersFromEnv(
  env: Pick<Env, "GEMINI_API_KEY" | "GROQ_API_KEY" | "AI"> & {
    GEMINI_MODEL?: string;
    GROQ_MODEL?: string;
    WORKERS_AI_MODEL?: string;
  },
): LlmProvider[] {
  const out: LlmProvider[] = [];
  if (env.GEMINI_API_KEY) out.push(new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL));
  if (env.GROQ_API_KEY) out.push(new GroqProvider(env.GROQ_API_KEY, env.GROQ_MODEL));
  if (env.AI) out.push(new WorkersAiProvider(env.AI, env.WORKERS_AI_MODEL));
  return out;
}
