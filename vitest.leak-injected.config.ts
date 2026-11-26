import { defineConfig } from "vitest/config";
// Runs only the deliberately leaking fixture. Used by the leak suite to prove the gate fails on a leak.
export default defineConfig({
  test: {
    include: ["apps/worker/src/prompts/fixtures/leak-injected.fixture-test.ts"],
    passWithNoTests: false,
  },
});
