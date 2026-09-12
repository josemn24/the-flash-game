import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./GameApp.tsx", import.meta.url), "utf8");

describe("GameApp routing", () => {
  it("routes every survival challenge to the Flash Pop shell", () => {
    expect(source).toContain("FlashPopSurvivalGame.client");
    expect(source).toContain('if (challenge.mode === "survival")');
    expect(source).toMatch(/<FlashPopSurvivalGame\s+[\s\S]*?challenge=\{challenge\}/);
    expect(source).not.toContain("SurvivalGameApp");
  });

  it("keeps Narrative on its dedicated Flash Pop-compatible app", () => {
    expect(source).toContain("NarrativeGameApp.client");
    expect(source).toContain('if (challenge.mode === "narrative")');
    expect(source).toContain("NarrativeGameApp challenge={challenge}");
  });
});
