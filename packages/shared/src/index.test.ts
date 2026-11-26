import { expect, test } from "vitest";
import { PACKAGE } from "./index";
test("shared scaffold", () => {
  expect(PACKAGE).toBe("shared");
});
