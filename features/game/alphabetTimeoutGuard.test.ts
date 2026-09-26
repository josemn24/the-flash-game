import { describe, expect, it } from "vitest";
import { createAlphabetTimeoutGuard } from "./alphabetTimeoutGuard";

describe("Alphabet timeout guard", () => {
  it("allows timeout processing once per attempt despite timer reactivation", () => {
    const guard = createAlphabetTimeoutGuard();

    expect(guard.claim()).toBe(true);
    expect(guard.claim()).toBe(false);
    expect(guard.claim()).toBe(false);
  });
});
