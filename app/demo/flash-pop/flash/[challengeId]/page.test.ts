import { describe, expect, it } from "vitest";
import { dynamic } from "./page";

describe("Flash Pop Flash preview route", () => {
  it("resolves the pilot dynamically", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
