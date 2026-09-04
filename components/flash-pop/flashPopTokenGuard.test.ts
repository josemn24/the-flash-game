import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const questionInputCss = readFileSync(
  new URL("./FlashPopQuestionInput.module.css", import.meta.url),
  "utf8",
);

const nativeFormatStyles = [
  "AnswerOption.module.css",
  "AnagramQuestion.module.css",
  "ClassificationQuestion.module.css",
  "EstimationQuestion.module.css",
  "HeatMapQuestion.module.css",
  "MatchingQuestion.module.css",
  "OddOneOutQuestion.module.css",
  "OrderingQuestion.module.css",
  "ProgressiveImageQuestion.module.css",
  "TrueFalseQuestion.module.css",
].map((filename) => ({
  filename,
  css: readFileSync(new URL(`../${filename}`, import.meta.url), "utf8"),
}));

describe("Flash Pop token boundary", () => {
  it("scopes every important compatibility override to legacy formats", () => {
    expect(questionInputCss).not.toMatch(/\.flashPopFormat:not\(/);

    for (const rule of questionInputCss.split("}")) {
      if (rule.includes("!important")) {
        expect(rule.split("{", 1)[0]).toContain(".legacyCompatFormat");
      }
    }
  });

  it("keeps native format styles on canonical semantic tokens", () => {
    for (const { filename, css } of nativeFormatStyles) {
      expect(css, filename).not.toContain("var(--pop-");
      expect(css, filename).not.toContain("!important");
    }
  });
});
