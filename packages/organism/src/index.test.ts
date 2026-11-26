import { expect, test } from "vitest";
import { PACKAGE } from "./index";
test("organism scaffold", () => {
  expect(PACKAGE).toBe("organism");
});
