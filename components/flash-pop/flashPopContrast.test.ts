import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const theme = readFileSync(new URL("./FlashPopTheme.module.css", import.meta.url), "utf8");
const globals = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const stateStyles = [
  "../MiniWordleQuestion.module.css",
  "../WordHashtagQuestion.module.css",
  "../WordSearchQuestion.module.css",
  "../LogicMatrixQuestion.module.css",
  "../QueensQuestion.module.css",
  "../ConnectPairsQuestion.module.css",
  "../LogicCodeQuestion.module.css",
  "../ProgressiveCluesQuestion.module.css",
].map((filename) => ({
  filename,
  css: readFileSync(new URL(filename, import.meta.url), "utf8"),
}));

function token(name: string) {
  const match = globals.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Missing hex token --${name}`);
  return match[1];
}

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((part) => Number.parseInt(part, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("Flash Pop token contrast", () => {
  it.each([
    ["ink on brand", "ink", "brand"],
    ["ink on surface", "ink", "surface"],
    ["muted on canvas", "ink-muted", "canvas"],
    ["muted on surface", "ink-muted", "surface"],
    ["muted on surface soft", "ink-muted", "surface-soft"],
    ["focus on surface", "focus", "surface"],
    ["surface on social", "surface", "social"],
    ["ink on reward", "ink", "reward"],
    ["surface on success", "surface", "success"],
    ["ink on danger", "ink", "danger"],
    ["ink on info", "ink", "info"],
  ])("keeps %s at WCAG AA for normal text", (_label, foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps Pop aliases wired to the semantic API", () => {
    expect(theme).toContain("--pop-color-brand: var(--color-brand)");
    expect(theme).toContain("--pop-space-6: var(--space-6)");
    expect(theme).toContain("--pop-font-ui: var(--type-ui)");
  });

  it("publishes the shared puzzle state roles", () => {
    for (const [state, color] of [
      ["correct", "success"],
      ["movable", "brand"],
      ["selected", "social"],
      ["neutral", "surface-soft"],
      ["error", "danger"],
      ["focus", "focus"],
    ]) {
      expect(theme).toContain(`--pop-state-${state}: var(--pop-color-${color})`);
    }
  });

  it("uses state roles in every migrated state-bearing Pop format", () => {
    const requiredTokensByFormat = new Map([
      ["MiniWordleQuestion.module.css", ["correct", "movable", "neutral", "focus"]],
      ["WordHashtagQuestion.module.css", ["correct", "movable", "selected", "focus"]],
      ["WordSearchQuestion.module.css", ["correct", "selected", "error", "focus"]],
      ["LogicMatrixQuestion.module.css", ["selected"]],
      ["QueensQuestion.module.css", ["selected", "error"]],
      ["ConnectPairsQuestion.module.css", ["selected", "focus"]],
      ["LogicCodeQuestion.module.css", ["selected", "focus"]],
      ["ProgressiveCluesQuestion.module.css", ["selected", "focus"]],
    ]);

    for (const { filename, css } of stateStyles) {
      const formatFilename = filename.split("/").pop();
      for (const state of requiredTokensByFormat.get(formatFilename ?? "") ?? []) {
        expect(css, filename).toContain(`var(--pop-state-${state})`);
      }
    }
  });

  it("keeps empty Mini-Wordle tiles on the white surface", () => {
    const miniWordle = stateStyles.find(({ filename }) =>
      filename.endsWith("MiniWordleQuestion.module.css"),
    );
    expect(miniWordle?.css).toMatch(
      /\.pop \.empty \{[\s\S]*background: var\(--pop-color-surface\);/,
    );
  });

  it("publishes the complete semantic token groups", () => {
    for (const tokenName of [
      "color-canvas",
      "type-ui",
      "border-subtle",
      "radius-card",
      "shadow-card",
      "space-6",
      "motion-press-in",
    ]) {
      expect(globals).toMatch(new RegExp(`--${tokenName}:`));
    }
  });
});
