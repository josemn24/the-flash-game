import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  readColorTokens,
  resolveColor,
  contrast,
} from "../../../../scripts/test-utils/color-tokens.mjs";

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

const tokens = readColorTokens(globals);
const color = (name: string) => resolveColor(`--ds-color-${name}`, tokens);
const roles = ["brand", "selected", "success", "error", "info", "reward"];
const lightSurfaces = ["canvas", "surface", "surface-raised", "surface-soft"];

describe("Flash Pop token contrast", () => {
  it.each(lightSurfaces)("checks normal foregrounds and essential indicators on %s", (surface) => {
    for (const fg of ["primary", "secondary", ...roles]) {
      expect(
        contrast(color(`fg-${fg}`), color(`bg-${surface}`)),
        `${fg} on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    for (const indicator of [
      "focus-ring",
      "border-strong",
      ...roles.filter((role) => role !== "brand").map((role) => `border-${role}`),
    ]) {
      expect(
        contrast(color(indicator), color(`bg-${surface}`)),
        `${indicator} on ${surface}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(roles)("checks solid, soft and inverse pairs for %s", (role) => {
    expect(contrast(color(`fg-on-${role}`), color(`bg-${role}`))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color(`fg-${role}-inverse`), color("bg-inverse"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color(`border-${role}-inverse`), color("bg-inverse"))).toBeGreaterThanOrEqual(
      3,
    );
    if (role !== "brand") {
      for (const fg of [`fg-${role}`, "fg-primary", "fg-secondary"]) {
        expect(
          contrast(color(fg), color(`bg-${role}-soft`)),
          `${fg} on ${role}-soft`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(color(`border-${role}`), color(`bg-${role}-soft`))).toBeGreaterThanOrEqual(3);
      expect(contrast(color("focus-ring"), color(`bg-${role}-soft`))).toBeGreaterThanOrEqual(3);
    }
  });

  it("resolves aliases, sRGB mixes and transparent overlays", () => {
    expect(color("bg-selected-soft")).toEqual(color("bg-surface-soft"));
    expect(color("border-error")).toEqual(color("fg-error"));
    const surface = color("bg-surface");
    const error = color("bg-error");
    expect(color("bg-error-soft")[0]).toBeCloseTo(error[0] * 0.12 + surface[0] * 0.88);
    for (const background of lightSurfaces) {
      expect(
        contrast(color("fg-on-inverse"), color("bg-overlay"), color(`bg-${background}`)),
      ).toBeGreaterThanOrEqual(4.5);
    }
    for (const fg of ["fg-on-inverse", "fg-secondary-inverse"])
      expect(contrast(color(fg), color("bg-inverse"))).toBeGreaterThanOrEqual(4.5);
    expect(
      resolveColor("color-mix(in srgb, var(--ds-color-bg-brand) 8%, transparent)", tokens)[3],
    ).toBeCloseTo(0.08);
    expect(() => resolveColor("var(--missing, white)", tokens)).toThrow("Unknown token");
    expect(() =>
      resolveColor(
        "--a",
        new Map([
          ["--a", "var(--b)"],
          ["--b", "var(--a)"],
        ]),
      ),
    ).toThrow("cycle");
  });

  it("keeps the canonical tokens free of Pop aliases", () => {
    expect(globals).not.toContain("--pop-");
    expect(globals).toContain("--ds-color-bg-brand:");
    expect(globals).toContain("--space-6:");
    expect(globals).toContain("--type-ui:");
  });

  it("retires the ambiguous API without compatibility aliases", () => {
    expect(globals).not.toMatch(/--state-[\w-]+/);
    expect(globals).not.toMatch(/--color-(?!background|foreground)[\w-]+/);
    for (const role of roles) {
      for (const family of ["bg", "fg", "border"])
        expect(tokens.has(`--ds-color-${family}-${role}`)).toBe(true);
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
        const role =
          (
            {
              correct: "success",
              movable: "brand",
              neutral: "surface-soft",
              focus: "focus-ring",
            } as Record<string, string>
          )[state] ?? state;
        expect(css, filename).toMatch(
          new RegExp(`var\\(--ds-color-(?:(?:bg|fg|border)-)?${role}\\)`),
        );
      }
    }
  });

  it("keeps every format on the canonical Flash Pop surface", () => {
    expect(formatStyles).toHaveLength(29);

    for (const { filename, css } of formatStyles) {
      expect(css, filename).not.toContain("data-variant");
      expect(css, filename).not.toContain(["data", "theme"].join("-"));
      expect(css, filename).not.toMatch(
        new RegExp(
          ["--pop-", ["Legacy", "Theme"].join(""), ["legacy", "-dark"].join("")].join("|"),
        ),
      );
    }

    expect(reviewStyles).toContain("background: var(--ds-color-bg-surface);");
    expect(reviewStyles).toContain("color: var(--ds-color-fg-primary);");
    expect(reviewStyles).toContain("var(--ds-color-bg-success)");
    expect(reviewStyles).toContain("var(--ds-color-bg-error)");
  });

  it("keeps empty Mini-Wordle tiles on the white surface", () => {
    const miniWordle = stateStyles.find(({ filename }) =>
      filename.endsWith("MiniWordleQuestion.module.css"),
    );
    expect(miniWordle?.css).toMatch(/\.empty \{[\s\S]*background: var\(--ds-color-bg-surface\);/);
  });

  it("uses white text on solid green review tiles", () => {
    expect(reviewStyles).toContain(".wordle-correct {\n    color: var(--ds-color-fg-on-success);");
    expect(reviewStyles).toContain(
      ".wordHashtagReviewCorrect {\n    color: var(--ds-color-fg-on-success);",
    );
  });

  it("keeps Classification selections visible without overpowering the table", () => {
    expect(classificationStyles).toMatch(
      /\.matrix,\s*\.binaryList\s*\{[\s\S]*?border: var\(--border-subtle\);[\s\S]*?border-radius: var\(--radius-card\);[\s\S]*?padding: var\(--space-2\);[\s\S]*?background: var\(--ds-color-bg-surface\);/,
    );
    expect(classificationStyles).toContain("border: 1px solid rgb(23 23 32 / 17%);");
    expect(classificationStyles).toContain("box-shadow: 0 1px 2px rgb(23 23 32 / 5%);");
    expect(classificationStyles).toContain(
      "background: color-mix(in srgb, var(--ds-color-bg-selected) 15%, var(--ds-color-bg-surface));",
    );
    expect(classificationStyles).toContain(
      "color-mix(in srgb, var(--ds-color-bg-selected) 14%, transparent)",
    );
    expect(classificationStyles).toMatch(
      /\.choiceButtonSelected:focus-visible,\s*\.binaryChoiceSelected:focus-visible/,
    );
  });

  it("publishes the complete semantic token groups", () => {
    for (const tokenName of [
      "ds-color-bg-canvas",
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
