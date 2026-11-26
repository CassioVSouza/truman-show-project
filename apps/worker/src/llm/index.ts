import type { Env } from "../env";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import type { LlmProvider } from "./types";

export { LlmClient, extractJson } from "./client";
export type { GenerateRequest, GenerateResult, ClientOptions } from "./client";
export { GeminiProvider, GEMINI_DEFAULT_MODEL } from "./gemini";
export { GroqProvider, GROQ_DEFAULT_MODEL } from "./groq";
export { FakeProvider } from "./fake";
export type { FakeReply } from "./fake";
export { LLMError } from "./types";
export type {
  LLMErrorKind,
  LlmProvider,
  LlmRole,
  LlmTraceRow,
  ProviderUsage,
  RawCompletion,
  RawRequest,
} from "./types";

/** Provider order from config: Gemini first, Groq second. Keys come only from the Worker env. */
export function providersFromEnv(
  env: Pick<Env, "GEMINI_API_KEY" | "GROQ_API_KEY"> & {
    GEMINI_MODEL?: string;
    GROQ_MODEL?: string;
  },
): LlmProvider[] {
  const out: LlmProvider[] = [];
  if (env.GEMINI_API_KEY) out.push(new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL));
  if (env.GROQ_API_KEY) out.push(new GroqProvider(env.GROQ_API_KEY, env.GROQ_MODEL));
  return out;
}
