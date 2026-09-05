import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const roots = ["app", "components", "features", "data", "lib"].map((directory) =>
  fileURLToPath(new URL(`../../${directory}`, import.meta.url)),
);

function collect(directory: string, files: string[]) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (
      path.includes("/flash-pop-concepts/") ||
      path.includes("/flash-pop-typography/") ||
      path.includes("/flash-pop/ui-kit/")
    ) {
      continue;
    }
    if (statSync(path).isDirectory()) collect(path, files);
    else if (/\.(?:tsx?|css)$/.test(path) && !path.includes(".test.")) files.push(path);
  }
}

describe("product design-system boundaries", () => {
  it("uses Flash Pop as the only product theme", () => {
    const layout = readFileSync(
      fileURLToPath(new URL("../../app/layout.tsx", import.meta.url)),
      "utf8",
    );

    expect(layout).toContain('data-theme="flash-pop"');
    expect(layout).not.toContain("legacy-dark");
  });

  it("keeps product code on the canonical UI and token APIs", () => {
    const sourceFiles: string[] = [];
    roots.forEach((root) => collect(root, sourceFiles));
    const productFiles = sourceFiles;

    const forbiddenImportFiles = productFiles.filter((path) =>
      readFileSync(path, "utf8").includes("@/components/flash-pop/ui"),
    );
    const forbiddenTokenFiles = productFiles.filter((path) =>
      /--pop-|--(?:ink|panel|panel-light|electric|cyan|coral|muted|surface-subtle|surface-panel|text-muted|font-body|font-display)/.test(
        readFileSync(path, "utf8"),
      ),
    );
    const forbiddenIdentifierFiles = productFiles.filter((path) =>
      /\bPop(?:Avatar|Button|ButtonLink|Chip|Card|Canvas|IconButton|Timer|TimerDisplay|GameHeader)\b|legacyCompatFormat/.test(
        readFileSync(path, "utf8"),
      ),
    );
    const forbiddenThemeFiles = productFiles.filter((path) =>
      /LegacyTheme|legacy-dark/.test(readFileSync(path, "utf8")),
    );

    expect(forbiddenImportFiles).toEqual([]);
    expect(forbiddenTokenFiles).toEqual([]);
    expect(forbiddenIdentifierFiles).toEqual([]);
    expect(forbiddenThemeFiles).toEqual([]);
  });
});
