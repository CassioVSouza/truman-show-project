// Wire formats: the only place a built prompt becomes a provider request body (keeps provider code free of
// prompt construction). Safety settings are the least restrictive each API allows; refusals are handled by
// fallback, never by rewriting.
import type { PromptMessage } from "./build";

export interface WireRequest {
  system: string;
  messages: PromptMessage[];
  temperature: number;
  maxOutputTokens: number;
}

const GEMINI_CATEGORIES = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
  "HARM_CATEGORY_CIVIC_INTEGRITY",
];

export function geminiBody(r: WireRequest): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: r.system }] },
    contents: r.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: r.temperature,
      maxOutputTokens: r.maxOutputTokens,
      responseMimeType: "application/json",
    },
    safetySettings: GEMINI_CATEGORIES.map((category) => ({ category, threshold: "BLOCK_NONE" })),
  };
}

export function chatBody(model: string, r: WireRequest): Record<string, unknown> {
  return {
    model,
    messages: [{ role: "system", content: r.system }, ...r.messages],
    temperature: r.temperature,
    max_tokens: r.maxOutputTokens,
    response_format: { type: "json_object" },
  };
}

/** One repair retry: the same conversation plus the invalid reply and what was wrong with it. */
export function repairMessages(
  messages: PromptMessage[],
  badReply: string,
  problem: string,
): PromptMessage[] {
  return [
    ...messages,
    { role: "assistant", content: badReply.slice(0, 4000) },
    {
      role: "user",
      content: `That reply could not be used: ${problem.slice(0, 600)}\nAnswer again with only the JSON object, in the format described.`,
    },
  ];
}
