import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./GameApp.tsx", import.meta.url), "utf8");

describe("GameApp Alphabet routing", () => {
  it("routes all Alphabet challenges to Flash Pop", () => {
    expect(source).toContain("FlashPopAlphabetGame.client");
    expect(source).toContain('if (challenge.mode === "alphabet")');
    expect(source).toContain("FlashPopAlphabetGame challenge={challenge}");
    expect(source).not.toContain("AlphabetGameApp");
  });
});
