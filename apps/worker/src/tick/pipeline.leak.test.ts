// Leak test over the REAL pipeline: every prompt a multi-day run sends to a provider is scanned. The Resident
// prompts must carry no hidden state; the Interpreter prompts must never contain the persona.
import { describe, expect, test } from "vitest";
import { PERSONA } from "../prompts/persona";
import {
  EMOTION_LABELS,
  FRAMING_WORDS,
  scanPrompt,
  strictHiddenNames,
  type LeakRules,
} from "../prompts/leak-scan";
import { FAKE_SECRETS, hiddenKeyNames } from "../prompts/fixtures/hidden";
import { FakeProvider } from "../llm";
import { makeAgent, simulate } from "./testkit";

const rules: LeakRules = {
  hiddenNames: strictHiddenNames(hiddenKeyNames()),
  secrets: Object.values(FAKE_SECRETS),
  framingWords: FRAMING_WORDS,
  emotionLabels: EMOTION_LABELS,
};

describe("pipeline prompts over three simulated days", async () => {
  let agent: FakeProvider | undefined;
  await simulate({
    days: 3,
    providers: (db) => [(agent = makeAgent(db))],
    tools: {
      webSearch: async () => ({
        ok: true,
        text: "A language model is a program. The system prompt.",
        bytes: 10,
      }),
      readPage: async () => ({ ok: false, text: "", bytes: 0 }),
    },
  });
  const resident = (agent?.calls ?? []).filter((c) => c.role === "resident");
  const interpreter = (agent?.calls ?? []).filter((c) => c.role === "interpreter");
  const text = (c: { system: string; messages: { content: string }[] }) =>
    `${c.system}\n${c.messages.map((m) => m.content).join("\n")}`;

  test("the run produced many Resident prompts and some Interpreter prompts", () => {
    expect(resident.length).toBeGreaterThan(100);
    expect(interpreter.length).toBeGreaterThan(0);
  });

  test("no Resident prompt leaks hidden state, framing, emotion labels, names or secrets", () => {
    const bad: string[] = [];
    for (const c of resident) {
      // repair retries append our own plain request; scanning them too is fine
      const leaks = scanPrompt(text(c), rules);
      if (leaks.length) bad.push(JSON.stringify(leaks).slice(0, 200));
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  test("no digits reach the Resident except plain distances in metres (decision 29) and memory citations", () => {
    const bad = new Set<string>();
    for (const c of resident) {
      const stripped = text(c).replace(/<<<untrusted[\s\S]*?end of untrusted page content>>>/g, "");
      for (const m of stripped.matchAll(/.{0,25}\d.{0,12}/g)) {
        if (!/\d+ m\b/.test(m[0]) && !/\bmemory:\d+\b/.test(m[0])) bad.add(m[0]);
      }
    }
    expect([...bad].slice(0, 5)).toEqual([]);
  });

  test("web text reaches the Resident only inside the untrusted block", () => {
    const withWeb = resident.filter((c) => text(c).includes("A language model is a program"));
    expect(withWeb.length).toBeGreaterThan(0);
    for (const c of withWeb) {
      const t = text(c);
      const open = t.indexOf("<<<untrusted page content");
      const close = t.indexOf("<<<end of untrusted page content>>>");
      const at = t.indexOf("A language model is a program");
      expect(open).toBeGreaterThan(-1);
      expect(at).toBeGreaterThan(open);
      expect(at).toBeLessThan(close);
    }
  });

  test("the Interpreter never sees the persona, and the Resident persona carries no hidden words", () => {
    for (const c of interpreter) {
      expect(text(c)).not.toContain(PERSONA.slice(0, 60));
      expect(text(c)).not.toContain("You do not have a name");
    }
    expect(resident.every((c) => c.system.includes(PERSONA))).toBe(true);
  });

  test("cognitive fatigue only changes numbers: temperature and token cap stay in range", () => {
    for (const c of resident) {
      expect(c.temperature).toBeGreaterThanOrEqual(0.5);
      expect(c.temperature).toBeLessThanOrEqual(0.8);
      expect(c.maxOutputTokens).toBeGreaterThanOrEqual(600);
      expect(c.maxOutputTokens).toBeLessThanOrEqual(1200);
    }
  });
});
