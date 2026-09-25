import { describe, expect, it } from "vitest";
import { dynamic } from "./page";

describe("legacy Flash Pop Pyramid route", () => {
  it("resolves preview aliases dynamically", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
