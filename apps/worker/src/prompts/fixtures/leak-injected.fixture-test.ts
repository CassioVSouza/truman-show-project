// DELIBERATELY LEAKING fixture. Never part of `pnpm test` or `pnpm leak-test`: it is only run by
// leak.leak.test.ts through a child vitest process, to prove the leak gate really fails when a leak exists.
import { expect, test } from "vitest";
import { buildPrompt } from "../build";
import { EMOTION_LABELS, FRAMING_WORDS, scanPrompt, strictHiddenNames } from "../leak-scan";
import { cleanInput } from "./clean-input";
import { FAKE_SECRETS, hiddenKeyNames } from "./hidden";

test("injected leak must be caught (this test is EXPECTED TO FAIL)", () => {
  const leaky = buildPrompt(
    cleanInput({
      sensations: ["health: 87/100", "info_hunger is high", `key ${FAKE_SECRETS.GEMINI_API_KEY}`],
    }),
  );
  const leaks = scanPrompt(leaky.messages[0]!.content, {
    hiddenNames: strictHiddenNames(hiddenKeyNames()),
    secrets: Object.values(FAKE_SECRETS),
    framingWords: FRAMING_WORDS,
    emotionLabels: EMOTION_LABELS,
  });
  expect(leaks).toEqual([]); // fails because leaks were found
});
