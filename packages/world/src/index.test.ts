import { expect, test } from "vitest";
import { PACKAGE } from "./index";
test("world scaffold", () => {
  expect(PACKAGE).toBe("world");
});
