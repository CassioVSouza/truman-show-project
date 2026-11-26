import { describe, expect, test } from "vitest";
import {
  ALL_ACTIONS,
  buildInterpreterPrompt,
  buildPrompt,
  geminiBody,
  menuLines,
  repairMessages,
} from "./index";
import { PERSONA } from "./persona";
import { cleanInput } from "./fixtures/clean-input";

describe("menu and output format", () => {
  test("lists every available action, no digits, no moral or story text", () => {
    const text = menuLines(ALL_ACTIONS).join("\n");
    for (const a of ALL_ACTIONS) expect(text).toContain(`- ${a}:`);
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(/\b(should|must not|never|dangerous|harm|safe)\b/i);
  });
  test("restricting the menu removes the action", () => {
    expect(menuLines(ALL_ACTIONS.filter((a) => a !== "web_search")).join("\n")).not.toContain(
      "- web_search:",
    );
  });
  test("the new hands-know section sits between body and perception when present, absent otherwise", () => {
    const withIt = buildPrompt(cleanInput({ handsKnow: ["You know how to drink."] })).messages[0]!
      .content;
    expect(withIt.indexOf("[YOUR BODY RIGHT NOW]")).toBeLessThan(
      withIt.indexOf("[WHAT YOUR HANDS KNOW]"),
    );
    expect(withIt.indexOf("[WHAT YOUR HANDS KNOW]")).toBeLessThan(
      withIt.indexOf("[WHAT YOU SEE/HEAR]"),
    );
    expect(buildPrompt(cleanInput()).messages[0]!.content).not.toContain("HANDS KNOW");
  });
});

describe("place awareness (decision 41)", () => {
  test("decide prompt carries the perception and a neutral place instruction, no prohibition", () => {
    const text = buildPrompt(cleanInput({ availableActions: menuLines(ALL_ACTIONS) })).messages[0]!
      .content;
    const all = text;
    expect(all).toContain("[WHAT YOU SEE/HEAR]");
    expect(all).toContain("a tall tree, 6 m ahead");
    expect(all).toContain("Where you are and what is near");
    expect(all).toContain("Where you are and what is near");
    expect(all).not.toMatch(/do not (sleep|rest)|never (sleep|rest)/i);
  });
  test("interpreter mentions place", () => {
    const p = buildInterpreterPrompt({
      stimulus: "a",
      action: "b",
      intent: "c",
      expectation: "d",
      outcome: "e",
    });
    expect(p.system).toContain("place where the subject was");
  });
});

describe("Interpreter prompt", () => {
  const p = buildInterpreterPrompt({
    stimulus: "a page",
    action: "to read",
    intent: "learn",
    expectation: "facts",
    outcome: "read it",
  });
  test("never contains the persona", () => {
    expect(`${p.system}\n${p.messages[0]!.content}`).not.toContain(PERSONA.slice(0, 40));
    expect(p.system).not.toMatch(/You do not have a name|living being|woke up in a wooden cabin/);
  });
  test("rejects extra fields (strict), so hidden objects cannot ride along", () => {
    expect(() =>
      buildInterpreterPrompt({
        stimulus: "a",
        action: "b",
        intent: "c",
        expectation: "d",
        outcome: "e",
        organism: {},
      } as never),
    ).toThrow();
  });
});

describe("wire formats", () => {
  test("Gemini body asks for JSON and turns every safety filter off", () => {
    const b = geminiBody({
      system: "s",
      messages: [{ role: "user", content: "x" }],
      temperature: 0.5,
      maxOutputTokens: 9,
    }) as {
      safetySettings: { threshold: string }[];
      generationConfig: { responseMimeType: string };
    };
    expect(b.generationConfig.responseMimeType).toBe("application/json");
    expect(b.safetySettings.length).toBeGreaterThanOrEqual(4);
    expect(b.safetySettings.every((s) => s.threshold === "BLOCK_NONE")).toBe(true);
  });
  test("repair keeps the original conversation and appends the bad reply and the problem", () => {
    const m = repairMessages([{ role: "user", content: "q" }], "bad", "missing action");
    expect(m).toHaveLength(3);
    expect(m[1]).toEqual({ role: "assistant", content: "bad" });
    expect(m[2]!.content).toContain("missing action");
  });
});
