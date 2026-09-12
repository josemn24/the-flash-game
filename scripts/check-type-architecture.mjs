import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const TYPES_ROOT = path.join(process.cwd(), "types");
const MOCK_ROOT = path.join(process.cwd(), "data", "mock");
const LEGACY_MOCK_BOUNDARIES = new Set([
  "legacyAdapters.ts",
  "legacyChallengeAdapter.ts",
  "legacyChallengeDefinitionAdapter.ts",
  "legacyQuestionAdapter.ts",
]);
const CANONICAL_MOCK_FILES = new Set([
  "attemptFixtures.ts",
  "challengeFixtures.ts",
  "questionFixtures.ts",
  "store.ts",
]);
const LEGACY_DATA_SOURCES = new Set([
  "@/data/questions",
  "@/data/challengeDefinitions",
  "@/data/mock/legacyAdapters",
  "@/data/mock/legacyChallengeAdapter",
  "@/data/mock/legacyChallengeDefinitionAdapter",
  "@/data/mock/legacyQuestionAdapter",
]);
const LAYERS = ["domain", "contracts", "gameplay", "view-models", "legacy"];
const FORBIDDEN_PROJECT_AREAS = [
  "application",
  "app",
  "components",
  "data",
  "features",
  "infrastructure",
  "lib",
  "server",
  "test-utils",
];
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
  const relativeFile = path.relative(MOCK_ROOT, file);
  const isCanonicalFixture =
    relativeFile.startsWith(`catalog${path.sep}`) || CANONICAL_MOCK_FILES.has(path.basename(file));
  for (const imported of importsIn(source)) {
    if (isCanonicalFixture && LEGACY_DATA_SOURCES.has(imported.specifier)) {
      violations.push(
        `${path.relative(process.cwd(), file)} makes canonical fixtures depend on ${imported.specifier}`,
      );
    }
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

const PRODUCTION_LAYERS = [
  "application",
  "app",
  "components",
  "features",
  "infrastructure",
  "lib",
  "server",
];
const productionFiles = (
  await Promise.all(
    PRODUCTION_LAYERS.map((layer) => collectTypeScriptFiles(path.join(process.cwd(), layer))),
  )
)
  .flat()
  .filter((file) => !/\.(?:test|spec)(?:-utils)?\.(?:ts|tsx)$/.test(path.basename(file)));

function projectArea(specifier) {
  return specifier.match(/^@\/([^/]+)/)?.[1] ?? null;
}

for (const file of productionFiles) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(process.cwd(), file);
  const layer = relative.split(path.sep)[0];

  for (const imported of importsIn(source)) {
    const area = projectArea(imported.specifier);

    if (
      layer === "application" &&
      (["app", "components", "data", "features", "infrastructure", "server", "test-utils"].includes(
        area,
      ) ||
        imported.specifier === "server-only")
    ) {
      violations.push(`${relative} makes application depend on ${imported.specifier}`);
    }

    if (layer === "app" && ["data", "infrastructure", "test-utils"].includes(area)) {
      violations.push(`${relative} bypasses the server facade via ${imported.specifier}`);
    }

    if (
      ["components", "features", "lib"].includes(layer) &&
      ["data", "infrastructure", "server", "test-utils"].includes(area)
    ) {
      violations.push(`${relative} crosses a client-safe boundary via ${imported.specifier}`);
    }

    if (layer === "server" && ["data", "app", "components", "test-utils"].includes(area)) {
      violations.push(`${relative} bypasses composition boundaries via ${imported.specifier}`);
    }

    if (
      layer === "infrastructure" &&
      area === "data" &&
      !relative.startsWith(`infrastructure${path.sep}mock${path.sep}`)
    ) {
      violations.push(`${relative} imports mock data outside infrastructure/mock`);
    }

    if (
      layer === "infrastructure" &&
      imported.specifier.startsWith("@/data/") &&
      !imported.specifier.startsWith("@/data/mock/")
    ) {
      violations.push(`${relative} imports a legacy data projection ${imported.specifier}`);
    }
  }
}

const serverFacade = path.join(process.cwd(), "server", "data-access.ts");
const serverFacadeSource = await readFile(serverFacade, "utf8");
if (!/^import ["']server-only["'];/m.test(serverFacadeSource)) {
  violations.push("server/data-access.ts is missing the server-only marker");
}
if (!/import\s+\{\s*cache\s*\}\s+from\s+["']react["']/.test(serverFacadeSource)) {
  violations.push("server/data-access.ts does not use React request memoization");
}

if (violations.length > 0) {
  console.error(
    "Type architecture violations:\n" + violations.map((item) => `- ${item}`).join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Type architecture OK (${files.length} type files, ${mockFiles.length} mock files and ${productionFiles.length} production files checked).`,
  );
}
