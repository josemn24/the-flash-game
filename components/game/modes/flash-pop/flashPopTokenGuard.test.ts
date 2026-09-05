import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const roots = ["app", "components", "features", "data", "lib"].map((directory) =>
  join(projectRoot, directory),
);
const componentsRoot = join(projectRoot, "components");
const requiredDomains = ["effects", "game", "library", "navigation", "questions", "ui"];
const questionFormatsRoot = join(componentsRoot, "questions/formats");

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
    const layout = readFileSync(join(projectRoot, "app/layout.tsx"), "utf8");

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

  it("keeps the components root organized by domain", () => {
    const rootFiles = readdirSync(componentsRoot).filter((entry) =>
      statSync(join(componentsRoot, entry)).isFile(),
    );
    expect(rootFiles).toEqual([]);
    for (const domain of requiredDomains) {
      expect(statSync(join(componentsRoot, domain)).isDirectory()).toBe(true);
    }
  });

  it("publishes the domain barrels", () => {
    expect(readFileSync(join(componentsRoot, "questions/index.ts"), "utf8")).toContain(
      'export * from "./formats"',
    );
    expect(readFileSync(join(componentsRoot, "game/index.ts"), "utf8")).toContain(
      'export * from "./shared"',
    );
    expect(readFileSync(join(componentsRoot, "navigation/index.ts"), "utf8")).toContain(
      "export { Logo }",
    );
    expect(readFileSync(join(componentsRoot, "effects/index.ts"), "utf8")).toContain(
      "export { SpeedBackground }",
    );
  });

  it("keeps specialized question formats co-located with their styles", () => {
    const expectedFormats = [
      "anagram",
      "classification",
      "connect-pairs",
      "error-reconstruction",
      "escape",
      "estimation",
      "flash-memory",
      "heat-map",
      "image-labeling",
      "logic-code",
      "logic-matrix",
      "matching",
      "memory-pairs",
      "mini-nonogram",
      "mini-sudoku",
      "mini-wordle",
      "odd-one-out",
      "ordering",
      "pipes",
      "progressive-clues",
      "progressive-image",
      "queens",
      "simon-sequence",
      "sliding-puzzle",
      "time-maze",
      "true-false",
      "word-hashtag",
      "word-search",
      "zip",
    ];
    const actualFormats = readdirSync(questionFormatsRoot)
      .filter((entry) => statSync(join(questionFormatsRoot, entry)).isDirectory())
      .sort();

    expect(actualFormats).toEqual(expectedFormats);
    for (const format of expectedFormats) {
      const files = readdirSync(join(questionFormatsRoot, format));
      expect(files.some((file) => file.endsWith(".tsx"))).toBe(true);
      expect(files.some((file) => file.endsWith(".module.css"))).toBe(true);
    }
  });

  it("has no circular dependencies between component domains", () => {
    const graph = new Map<string, Set<string>>();
    const componentFiles = sourceFilesForGuard().filter((path) => /\.tsx?$/.test(path));

    for (const file of componentFiles) {
      const relative = file.slice(`${componentsRoot}/`.length);
      const sourceDomain = relative.split("/")[0];
      if (!requiredDomains.includes(sourceDomain)) continue;
      const source = readFileSync(file, "utf8");
      const dependencies = graph.get(sourceDomain) ?? new Set<string>();
      for (const match of source.matchAll(/from\s+["']@\/components\/([^"']+)["']/g)) {
        const importedPath = match[1];
        if (importedPath.endsWith(".css")) continue;
        const targetDomain = importedPath.split("/")[0];
        if (requiredDomains.includes(targetDomain) && targetDomain !== sourceDomain) {
          dependencies.add(targetDomain);
        }
      }
      graph.set(sourceDomain, dependencies);
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (domain: string): void => {
      if (visiting.has(domain))
        throw new Error(`Circular component-domain dependency at ${domain}`);
      if (visited.has(domain)) return;
      visiting.add(domain);
      for (const dependency of graph.get(domain) ?? []) visit(dependency);
      visiting.delete(domain);
      visited.add(domain);
    };

    for (const domain of requiredDomains) visit(domain);
  });
});

function sourceFilesForGuard() {
  const files: string[] = [];
  collect(componentsRoot, files);
  return files;
}
