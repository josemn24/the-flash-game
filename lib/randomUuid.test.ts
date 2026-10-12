import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUuid } from "./randomUuid";

afterEach(() => vi.unstubAllGlobals());

describe("randomUuid", () => {
  it("uses the native generator when available", () => {
    const native = vi.fn().mockReturnValue("native-uuid");
    vi.stubGlobal("crypto", { randomUUID: native });
    expect(randomUuid()).toBe("native-uuid");
    expect(native).toHaveBeenCalledOnce();
  });

  it.each([
    [0, "00000000-0000-4000-8000-000000000000"],
    [255, "ffffffff-ffff-4fff-bfff-ffffffffffff"],
  ])("generates a v4 UUID on HTTP origins with byte value %i", (byte, expected) => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(byte));
    vi.stubGlobal("crypto", { getRandomValues });
    expect(randomUuid()).toBe(expected);
    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(getRandomValues.mock.calls[0][0]).toHaveLength(16);
  });

  it("keeps keys distinct using secure randomness without randomUUID", () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    const first = randomUuid();
    const second = randomUuid();
    expect(first).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    expect(second).not.toBe(first);
  });

  it("fails if secure randomness is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => randomUuid()).toThrow("Secure random number generation is unavailable.");
  });
});
