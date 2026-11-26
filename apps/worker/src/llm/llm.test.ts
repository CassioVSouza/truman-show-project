import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  FakeProvider,
  GeminiProvider,
  GroqProvider,
  LLMError,
  LlmClient,
  extractJson,
} from "./index";

const schema = z.object({ ok: z.boolean() });
const req = {
  role: "resident" as const,
  system: "sys",
  messages: [{ role: "user" as const, content: "hi" }],
  schema,
  temperature: 0.5,
  maxOutputTokens: 100,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("extractJson", () => {
  test("plain, fenced and surrounded JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('Sure! {"a":3} done')).toEqual({ a: 3 });
    expect(() => extractJson("nope")).toThrow();
  });
});

describe("LlmClient", () => {
  test("validates with zod and traces every call", async () => {
    const p = new FakeProvider("a", { ok: true });
    const c = new LlmClient([p]);
    const r = await c.generate(req);
    expect(r.data).toEqual({ ok: true });
    expect(c.traces).toHaveLength(1);
    expect(c.traces[0]).toMatchObject({
      provider: "a",
      ok: true,
      role: "resident",
      system_prompt: "sys",
    });
    expect(c.usage.get("a")?.calls).toBe(1);
  });

  test("one repair retry on invalid JSON, then fallback to the next provider", async () => {
    const a = new FakeProvider("a", "garbage");
    const b = new FakeProvider("b", { ok: true });
    const c = new LlmClient([a, b]);
    const r = await c.generate(req);
    expect(r.provider).toBe("b");
    expect(a.calls).toHaveLength(2); // original + exactly one repair
    expect(c.traces.map((t) => [t.provider, t.ok])).toEqual([
      ["a", false],
      ["a", false],
      ["b", true],
    ]);
  });

  test.each(["RateLimited", "Unavailable", "Refused", "QuotaExhausted"] as const)(
    "%s moves to the next provider and is traced",
    async (kind) => {
      const a = new FakeProvider("a", new LLMError(kind, "x"));
      const b = new FakeProvider("b", { ok: true });
      const c = new LlmClient([a, b]);
      expect((await c.generate(req)).provider).toBe("b");
      expect(c.traces[0]).toMatchObject({ provider: "a", ok: false });
      expect(c.exhausted.has("a")).toBe(kind === "QuotaExhausted");
      expect(c.refusals.length).toBe(kind === "Refused" ? 1 : 0);
    },
  );

  test("a refusal's own text is kept in the trace, not rewritten", async () => {
    const a = new FakeProvider(
      "a",
      new LLMError("Refused", "blocked", { raw: "I won't say that" }),
    );
    const c = new LlmClient([a, new FakeProvider("b", { ok: true })]);
    await c.generate(req);
    expect(c.traces[0]!.response).toBe("I won't say that");
  });

  test("all failing throws Unavailable; the per-tick call cap holds", async () => {
    const a = new FakeProvider("a", new LLMError("Unavailable", "x"));
    await expect(new LlmClient([a]).generate(req)).rejects.toMatchObject({ kind: "Unavailable" });
    const bad = new FakeProvider("bad", "garbage");
    const c = new LlmClient([bad], { maxCalls: 1 });
    await expect(c.generate(req)).rejects.toThrow(/cap/);
    expect(bad.calls).toHaveLength(1);
  });
});

describe("Gemini adapter", () => {
  test("sends the key in a header with least-restrictive safety settings and JSON mode", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const p = new GeminiProvider("test-key-not-real-gemini", "m", async (u, i) => {
      seen = { url: u, init: i! };
      return json({
        candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
      });
    });
    const r = await p.complete({
      role: "resident",
      system: "s",
      messages: req.messages,
      temperature: 0.6,
      maxOutputTokens: 50,
    });
    expect(r).toMatchObject({ text: '{"ok":true}', tokens_in: 5, tokens_out: 2 });
    expect(seen!.url).not.toContain("test-key");
    expect((seen!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe(
      "test-key-not-real-gemini",
    );
    const body = JSON.parse(String(seen!.init.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(
      body.safetySettings.every((s: { threshold: string }) => s.threshold === "BLOCK_NONE"),
    ).toBe(true);
  });

  test("blocks and safety finishes are Refused; 429 daily is QuotaExhausted, per-minute RateLimited", async () => {
    const mk = (resp: () => Response) => new GeminiProvider("k", "m", async () => resp());
    const call = (p: GeminiProvider) =>
      p.complete({
        role: "resident",
        system: "s",
        messages: req.messages,
        temperature: 0.5,
        maxOutputTokens: 5,
      });
    await expect(
      call(mk(() => json({ promptFeedback: { blockReason: "SAFETY" } }))),
    ).rejects.toMatchObject({ kind: "Refused" });
    await expect(
      call(mk(() => json({ candidates: [{ finishReason: "SAFETY" }] }))),
    ).rejects.toMatchObject({ kind: "Refused" });
    await expect(
      call(
        mk(() =>
          json(
            {
              error: { message: "Quota exceeded: requests per day", status: "RESOURCE_EXHAUSTED" },
            },
            429,
          ),
        ),
      ),
    ).rejects.toMatchObject({ kind: "QuotaExhausted" });
    await expect(
      call(
        mk(() =>
          json(
            { error: { message: "Too many requests per minute", status: "RESOURCE_EXHAUSTED" } },
            429,
          ),
        ),
      ),
    ).rejects.toMatchObject({ kind: "RateLimited" });
    await expect(call(mk(() => json({}, 503)))).rejects.toMatchObject({ kind: "Unavailable" });
  });

  test("network errors never contain the key", async () => {
    const p = new GeminiProvider("test-key-not-real-gemini", "m", async () => {
      throw new Error("connect failed");
    });
    const e = await p
      .complete({
        role: "resident",
        system: "s",
        messages: req.messages,
        temperature: 0.5,
        maxOutputTokens: 5,
      })
      .catch((x: unknown) => x as LLMError);
    expect((e as LLMError).kind).toBe("Unavailable");
    expect((e as LLMError).message).not.toContain("test-key");
  });
});

describe("Groq adapter", () => {
  test("JSON mode, bearer auth, content_filter is Refused", async () => {
    let init: RequestInit | undefined;
    const ok = new GroqProvider("test-key-not-real-groq", "m", async (_u, i) => {
      init = i;
      return json({
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
        usage: { prompt_tokens: 3, completion_tokens: 1 },
      });
    });
    const r = await ok.complete({
      role: "resident",
      system: "s",
      messages: req.messages,
      temperature: 0.5,
      maxOutputTokens: 5,
    });
    expect(r.tokens_in).toBe(3);
    expect(JSON.parse(String(init!.body)).response_format).toEqual({ type: "json_object" });
    expect((init!.headers as Record<string, string>)["authorization"]).toBe(
      "Bearer test-key-not-real-groq",
    );
    const filtered = new GroqProvider("k", "m", async () =>
      json({ choices: [{ message: { content: "" }, finish_reason: "content_filter" }] }),
    );
    await expect(
      filtered.complete({
        role: "resident",
        system: "s",
        messages: req.messages,
        temperature: 0.5,
        maxOutputTokens: 5,
      }),
    ).rejects.toMatchObject({ kind: "Refused" });
  });
});
