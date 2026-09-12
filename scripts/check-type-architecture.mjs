import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const TYPES_ROOT = path.join(process.cwd(), "types");
const MOCK_ROOT = path.join(process.cwd(), "data", "mock");
const LEGACY_MOCK_BOUNDARIES = new Set([
  "challengeFixtures.ts",
  "legacyAdapters.ts",
  "legacyChallengeAdapter.ts",
  "questionFixtures.ts",
]);
const LAYERS = ["domain", "contracts", "gameplay", "view-models", "legacy"];
const FORBIDDEN_PROJECT_AREAS = ["data", "lib", "features", "components", "app"];
const ALLOWED_TYPE_DEPENDENCIES = {
  domain: ["domain"],
  contracts: ["contracts", "domain", "question"],
  gameplay: ["contracts", "domain", "gameplay", "question"],
  legacy: ["gameplay", "legacy", "question"],
  "view-models": ["contracts", "domain", "gameplay", "legacy", "question", "view-models"],
};

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectTypeScriptFiles(target);
      return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
    }),
  );
  return files.flat();
}

function layerFor(file) {
  return path.relative(TYPES_ROOT, file).split(path.sep)[0];
}

function importsIn(source) {
  const matches = source.matchAll(
    /(?:import|export)\s+(type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
  );
  return Array.from(matches, ([statement, typeOnly, specifier]) => ({
    statement,
    typeOnly: Boolean(typeOnly),
    specifier,
  }));
}

const files = (
  await Promise.all(LAYERS.map((layer) => collectTypeScriptFiles(path.join(TYPES_ROOT, layer))))
).flat();
const violations = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const layer = layerFor(file);

  for (const imported of importsIn(source)) {
    const projectArea = imported.specifier.match(/^@\/([^/]+)/)?.[1];
    if (projectArea && FORBIDDEN_PROJECT_AREAS.includes(projectArea)) {
      violations.push(
        `${path.relative(process.cwd(), file)} imports forbidden ${imported.specifier}`,
      );
    }

    if (imported.statement.startsWith("import") && !imported.typeOnly) {
      violations.push(
        `${path.relative(process.cwd(), file)} has runtime import ${imported.specifier}`,
      );
    }

    const importedTypeArea = imported.specifier.match(/^@\/types\/([^/]+)(?:\/|$)/)?.[1];
    if (importedTypeArea && !ALLOWED_TYPE_DEPENDENCIES[layer].includes(importedTypeArea)) {
      violations.push(
        `${path.relative(process.cwd(), file)} makes ${layer} depend on ${imported.specifier}`,
      );
    }
  }
}

const mockFiles = await collectTypeScriptFiles(MOCK_ROOT);
for (const file of mockFiles) {
  const source = await readFile(file, "utf8");
  const allowsLegacyDependencies = LEGACY_MOCK_BOUNDARIES.has(path.basename(file));
  for (const imported of importsIn(source)) {
    if (
      (!allowsLegacyDependencies &&
        (imported.specifier === "@/types/game" ||
          imported.specifier.startsWith("@/types/gameplay") ||
          imported.specifier.startsWith("@/types/legacy") ||
          imported.specifier.startsWith("@/types/question") ||
          imported.specifier.startsWith("@/types/view-models"))) ||
      imported.specifier.startsWith("@/components/") ||
      imported.specifier.startsWith("@/app/")
    ) {
      violations.push(
        `${path.relative(process.cwd(), file)} imports forbidden ${imported.specifier}`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error(
    "Type architecture violations:\n" + violations.map((item) => `- ${item}`).join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Type architecture OK (${files.length} type files and ${mockFiles.length} mock files checked).`,
  );
}
