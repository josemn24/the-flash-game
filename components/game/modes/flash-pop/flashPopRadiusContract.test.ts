import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cardStyles = readFileSync(new URL("../../../ui/Card.module.css", import.meta.url), "utf8");
const standardSurfaceStyles = [
  "./FlashPopAlphabetGame.module.css",
  "./FlashPopSurvivalResult.module.css",
  "./FlashPopPyramidGame.module.css",
  "../../shared/ChallengeIntro.module.css",
].map((filename) => ({
  filename,
  css: readFileSync(new URL(filename, import.meta.url), "utf8"),
}));

describe("Flash Pop radius contract", () => {
  it("reserves the zero-radius token for shared hero cards", () => {
    expect(cardStyles).toMatch(/\.card\s*\{[\s\S]*border-radius: var\(--radius-card\);/);
    expect(cardStyles).toMatch(/\.hero\s*\{[\s\S]*border-radius: var\(--radius-hero\);/);
  });

  it("uses the card radius on non-hero game surfaces", () => {
    for (const { filename, css } of standardSurfaceStyles) {
      expect(css, filename).toContain("var(--radius-card)");
      expect(css, filename).not.toContain("border-radius: var(--radius-hero);");
    }
  });
});
