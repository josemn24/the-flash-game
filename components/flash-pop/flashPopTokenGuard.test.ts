import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
  it("keeps the public UI imports on the canonical barrel", () => {
    const roots = ["app", "components", "features", "data", "lib"].map((directory) =>
      fileURLToPath(new URL(`../../${directory}`, import.meta.url)),
    );
    const sourceFiles: string[] = [];

    function collect(directory: string) {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        if (
          path.includes("/components/ui/") ||
          path.includes("/components/flash-pop/ui/") ||
          path.includes("/flash-pop-concepts/") ||
          path.includes("/flash-pop-typography/") ||
          path.includes("/flash-pop/ui-kit/")
        ) {
          continue;
        }
        if (statSync(path).isDirectory()) collect(path);
        else if (/\.(?:tsx?|css)$/.test(path) && !path.includes(".test.")) sourceFiles.push(path);
      }
    }

    roots.forEach(collect);
    const directLegacyImports = sourceFiles.flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes("@/components/flash-pop/ui") ? [path] : [];
    });

    expect(directLegacyImports).toEqual([]);
  });

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
