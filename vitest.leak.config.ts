import { defineConfig } from "vitest/config";
// `pnpm leak-test`: only the leak suite. Exits non-zero on any failure or if no test ran.
export default defineConfig({
  test: { include: ["apps/worker/src/**/*.leak.test.ts"], passWithNoTests: false },
});
