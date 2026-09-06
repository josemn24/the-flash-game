import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globals = readFileSync(new URL("../../../../app/globals.css", import.meta.url), "utf8");
const classificationStyles = readFileSync(
  new URL(
    "../../../questions/formats/classification/ClassificationQuestion.module.css",
    import.meta.url,
  ),
  "utf8",
);
const formatStylesRoot = new URL("../../../questions/formats/", import.meta.url);
const formatStyles = readdirSync(formatStylesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const directory = new URL(`${entry.name}/`, formatStylesRoot);
    const filename = readdirSync(directory).find((file) => file.endsWith(".module.css"));
    return filename
      ? [
          {
            filename: `${entry.name}/${filename}`,
            css: readFileSync(new URL(filename, directory), "utf8"),
          },
        ]
      : [];
  });
const reviewStyles = readFileSync(
  new URL("../../shared/ReviewAnswers.module.css", import.meta.url),
  "utf8",
);
const stateStyles = [
  "../../../questions/formats/mini-wordle/MiniWordleQuestion.module.css",
  "../../../questions/formats/word-hashtag/WordHashtagQuestion.module.css",
  "../../../questions/formats/word-search/WordSearchQuestion.module.css",
  "../../../questions/formats/logic-matrix/LogicMatrixQuestion.module.css",
  "../../../questions/formats/queens/QueensQuestion.module.css",
  "../../../questions/formats/connect-pairs/ConnectPairsQuestion.module.css",
  "../../../questions/formats/logic-code/LogicCodeQuestion.module.css",
  "../../../questions/formats/progressive-clues/ProgressiveCluesQuestion.module.css",
  "../../../questions/formats/image-labeling/ImageLabelingQuestion.module.css",
  "../../../questions/formats/flash-memory/FlashMemoryQuestion.module.css",
  "../../../questions/formats/memory-pairs/MemoryPairsQuestion.module.css",
  "../../../questions/formats/simon-sequence/SimonSequenceQuestion.module.css",
  "../../../questions/formats/mini-sudoku/MiniSudokuQuestion.module.css",
  "../../../questions/formats/mini-nonogram/MiniNonogramQuestion.module.css",
  "../../../questions/formats/sliding-puzzle/SlidingPuzzleQuestion.module.css",
  "../../../questions/formats/escape/EscapeQuestion.module.css",
  "../../../questions/formats/time-maze/TimeMazeQuestion.module.css",
  "../../../questions/formats/zip/ZipQuestion.module.css",
  "../../../questions/formats/pipes/PipesQuestion.module.css",
  "../../../questions/formats/error-reconstruction/ErrorReconstructionQuestion.module.css",
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

  it("keeps the canonical tokens free of Pop aliases", () => {
    expect(globals).not.toContain("--pop-");
    expect(globals).toContain("--color-brand:");
    expect(globals).toContain("--space-6:");
    expect(globals).toContain("--type-ui:");
  });

  it("publishes the shared puzzle state roles", () => {
    for (const state of ["correct", "movable", "selected", "neutral", "error", "focus"]) {
      expect(globals).toContain(`--state-${state}:`);
    }
  });

  it("uses state roles in every state-bearing format", () => {
    const requiredTokensByFormat = new Map([
      ["MiniWordleQuestion.module.css", ["correct", "movable", "neutral", "focus"]],
      ["WordHashtagQuestion.module.css", ["correct", "movable", "selected", "focus"]],
      ["WordSearchQuestion.module.css", ["correct", "selected", "error", "focus"]],
      ["LogicMatrixQuestion.module.css", ["selected"]],
      ["QueensQuestion.module.css", ["selected", "error"]],
      ["ConnectPairsQuestion.module.css", ["selected", "focus"]],
      ["LogicCodeQuestion.module.css", ["selected", "focus"]],
      ["ProgressiveCluesQuestion.module.css", ["selected", "focus"]],
      ["ImageLabelingQuestion.module.css", ["correct", "error", "focus"]],
      ["FlashMemoryQuestion.module.css", ["selected", "focus"]],
      ["MemoryPairsQuestion.module.css", ["selected", "correct", "error", "focus"]],
      ["SimonSequenceQuestion.module.css", ["selected", "focus"]],
      ["MiniSudokuQuestion.module.css", ["selected", "focus"]],
      ["MiniNonogramQuestion.module.css", ["selected", "focus"]],
      ["SlidingPuzzleQuestion.module.css", ["selected", "focus"]],
      ["EscapeQuestion.module.css", ["movable", "focus"]],
      ["TimeMazeQuestion.module.css", ["focus"]],
      ["ZipQuestion.module.css", ["selected", "focus"]],
      ["PipesQuestion.module.css", ["correct", "focus"]],
      ["ErrorReconstructionQuestion.module.css", ["selected", "focus"]],
    ]);

    for (const { filename, css } of stateStyles) {
      const formatFilename = filename.split("/").pop();
      for (const state of requiredTokensByFormat.get(formatFilename ?? "") ?? []) {
        expect(css, filename).toContain(`var(--state-${state})`);
      }
    }
  });

  it("scopes every format Flash Pop override and keeps review surfaces semantic", () => {
    expect(formatStyles).toHaveLength(29);

    for (const { filename, css } of formatStyles) {
      for (const selector of css.match(/[^{}]*data-variant="flash-pop"[^{}]*\{/g) ?? []) {
        expect(selector, filename).toContain('[data-variant="flash-pop"]');
      }
      expect(css, filename).not.toMatch(/--pop-|LegacyTheme|legacy-dark/);
    }

    expect(reviewStyles).toContain("background: var(--color-surface);");
    expect(reviewStyles).toContain("color: var(--color-ink);");
    expect(reviewStyles).toContain("var(--state-correct)");
    expect(reviewStyles).toContain("var(--state-error)");
  });

  it("keeps empty Mini-Wordle tiles on the white surface", () => {
    const miniWordle = stateStyles.find(({ filename }) =>
      filename.endsWith("MiniWordleQuestion.module.css"),
    );
    expect(miniWordle?.css).toMatch(/\.empty \{[\s\S]*background: var\(--color-surface\);/);
  });

  it("keeps Classification selections visible without overpowering the table", () => {
    expect(classificationStyles).toMatch(
      /\[data-variant="flash-pop"\]\s+\.matrix,\s*\[data-variant="flash-pop"\]\s+\.binaryList\s*\{\s*border: var\(--border-subtle\);\s*border-radius: var\(--radius-card\);\s*padding: var\(--space-2\);\s*background: var\(--color-surface\);/s,
    );
    expect(classificationStyles).toContain("border: 1px solid rgb(23 23 32 / 17%);");
    expect(classificationStyles).toContain("box-shadow: 0 1px 2px rgb(23 23 32 / 5%);");
    expect(classificationStyles).toContain(
      "background: color-mix(in srgb, var(--color-social) 15%, var(--color-surface));",
    );
    expect(classificationStyles).toContain(
      "color-mix(in srgb, var(--color-social) 14%, transparent)",
    );
    expect(classificationStyles).toMatch(
      /\.choiceButtonSelected:focus-visible,\s*\.binaryChoiceSelected:focus-visible/s,
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
