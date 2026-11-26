import { expect, test } from "vitest";
import { PACKAGE } from "./index";
test("body scaffold", () => {
  expect(PACKAGE).toBe("body");
});
