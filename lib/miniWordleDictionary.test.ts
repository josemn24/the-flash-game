import { afterEach, describe, expect, it, vi } from "vitest";
import dictionary4 from "@/public/dictionaries/es-general-4.v1.json";
import dictionary5 from "@/public/dictionaries/es-general-5.v1.json";
import { parseMiniWordleDictionary } from "@/lib/miniWordleDictionary";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Mini-Wordle dictionary", () => {
  it("ships a normalized, sorted and representative vocabulary", () => {
    const words = parseMiniWordleDictionary(dictionary4);
    const fiveLetterWords = parseMiniWordleDictionary(dictionary5, 5);
    expect(words.size).toBe(dictionary4.wordCount);
    expect(fiveLetterWords.size).toBe(dictionary5.wordCount);
    expect(words.has("AIRE")).toBe(true);
    expect(words.has("LUNA")).toBe(true);
    expect(words.has("CAÑA")).toBe(true);
    expect(words.has("AGIL")).toBe(true);
    expect(words.has("XXXX")).toBe(false);
    expect(fiveLetterWords.has("LIBRO")).toBe(true);
    expect(() => parseMiniWordleDictionary(dictionary4, 5)).toThrow();
  });

  it("caches each dictionary length independently", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => (url.includes("-5.") ? dictionary5 : dictionary4),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { loadMiniWordleDictionary } = await import("@/lib/miniWordleDictionary");
    const [first, second, third, fourth] = await Promise.all([
      loadMiniWordleDictionary(),
      loadMiniWordleDictionary(),
      loadMiniWordleDictionary(5),
      loadMiniWordleDictionary(5),
    ]);
    expect(first).toBe(second);
    expect(third).toBe(fourth);
    expect(first).not.toBe(third);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("/dictionaries/es-general-4.v1.json", {
      cache: "force-cache",
    });
    expect(fetchMock).toHaveBeenCalledWith("/dictionaries/es-general-5.v1.json", {
      cache: "force-cache",
    });
  });

  it("clears a failed load so the user can retry", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, json: async () => dictionary5 });
    vi.stubGlobal("fetch", fetchMock);
    const { loadMiniWordleDictionary } = await import("@/lib/miniWordleDictionary");
    await expect(loadMiniWordleDictionary(5)).rejects.toThrow("offline");
    await expect(loadMiniWordleDictionary(5)).resolves.toBeInstanceOf(Set);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
