import { afterEach, describe, expect, it, vi } from "vitest";
import dictionary from "@/public/dictionaries/es-general-4.v1.json";
import { parseMiniWordleDictionary } from "@/lib/miniWordleDictionary";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Mini-Wordle dictionary", () => {
  it("ships a normalized, sorted and representative vocabulary", () => {
    const words = parseMiniWordleDictionary(dictionary);
    expect(words.size).toBe(dictionary.wordCount);
    expect(words.has("AIRE")).toBe(true);
    expect(words.has("LUNA")).toBe(true);
    expect(words.has("CAÑA")).toBe(true);
    expect(words.has("AGIL")).toBe(true);
    expect(words.has("XXXX")).toBe(false);
  });

  it("loads the resource once and shares the in-flight promise", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => dictionary,
    });
    vi.stubGlobal("fetch", fetchMock);
    const { loadMiniWordleDictionary } = await import("@/lib/miniWordleDictionary");
    const [first, second] = await Promise.all([
      loadMiniWordleDictionary(),
      loadMiniWordleDictionary(),
    ]);
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears a failed load so the user can retry", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, json: async () => dictionary });
    vi.stubGlobal("fetch", fetchMock);
    const { loadMiniWordleDictionary } = await import("@/lib/miniWordleDictionary");
    await expect(loadMiniWordleDictionary()).rejects.toThrow("offline");
    await expect(loadMiniWordleDictionary()).resolves.toBeInstanceOf(Set);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
