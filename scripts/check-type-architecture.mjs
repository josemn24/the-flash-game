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
  "@/data/mock/legacyAdapters",
  "@/data/mock/legacyChallengeAdapter",
  "@/data/mock/legacyChallengeDefinitionAdapter",
  "@/data/mock/legacyQuestionAdapter",
]);
// Empty after the UI migration. If a short-lived adapter is ever unavoidable,
// add its production-relative path here and remove it as part of the same
// migration phase that introduced it.
const COMPATIBILITY_IMPORT_ALLOWLIST = new Set();
const LEGACY_TYPE_IMPORTS = new Set([
  "@/types/game",
  "@/types/question",
  "@/types/room",
  "@/types/challenge",
  "@/types/result",
  "@/types/session",
  "@/types/user",
  "@/types/legacy",
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
  contracts: ["contracts", "domain"],
  gameplay: ["contracts", "domain", "gameplay"],
  legacy: ["gameplay", "legacy", "question"],
  "view-models": ["contracts", "domain", "gameplay", "view-models"],
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
)
  .flat()
  .filter((file) => !/\.(?:test|spec)\.(?:ts|tsx)$/.test(path.basename(file)));
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

    if (LEGACY_TYPE_IMPORTS.has(imported.specifier) && layer !== "legacy") {
      violations.push(
        `${path.relative(process.cwd(), file)} imports legacy type barrel ${imported.specifier}`,
      );
    }

    if (
      layer === "contracts" &&
      (LEGACY_TYPE_IMPORTS.has(imported.specifier) ||
        imported.specifier.startsWith("@/types/compat/"))
    ) {
      violations.push(
        `${path.relative(process.cwd(), file)} makes contracts depend on a compatibility type`,
      );
    }

    if (
      layer === "view-models" &&
      (imported.specifier === "@/types/legacy" || imported.specifier.startsWith("@/types/compat/"))
    ) {
      violations.push(
        `${path.relative(process.cwd(), file)} exposes a legacy model through view-models`,
      );
    }
  }
}

const mockFiles = await collectTypeScriptFiles(MOCK_ROOT);
for (const file of mockFiles) {
  const source = await readFile(file, "utf8");
  const relativeFile = path.relative(MOCK_ROOT, file);
  const allowsLegacyDependencies =
    relativeFile.startsWith(`compat${path.sep}`) || LEGACY_MOCK_BOUNDARIES.has(path.basename(file));
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
          LEGACY_TYPE_IMPORTS.has(imported.specifier) ||
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

function isRoomSupabaseAdapter(relative) {
  return relative.startsWith(`infrastructure${path.sep}supabase${path.sep}rooms${path.sep}`);
}

function isSupabaseGeneratedType(specifier) {
  return specifier === "@/lib/supabase/database.types";
}

function isApplicationForbiddenImport(specifier) {
  return (
    specifier === "server-only" ||
    specifier.startsWith("next/") ||
    specifier === "next" ||
    specifier === "react" ||
    specifier.startsWith("@supabase/") ||
    specifier.startsWith("@/lib/supabase/") ||
    specifier.startsWith("@/server/") ||
    specifier.startsWith("@/infrastructure/")
  );
}

for (const file of productionFiles) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(process.cwd(), file);
  const layer = relative.split(path.sep)[0];
  const isScoringBoundary =
    relative.startsWith(`lib${path.sep}scoringCore${path.sep}`) ||
    relative.startsWith(`server${path.sep}evaluation${path.sep}`) ||
    relative ===
      path.join("app", "api", "competitive", "attempts", "[attemptId]", "answer", "route.ts");
  const isRoomAdapter = isRoomSupabaseAdapter(relative);

  for (const imported of importsIn(source)) {
    if (LEGACY_TYPE_IMPORTS.has(imported.specifier)) {
      violations.push(`${relative} imports legacy type barrel ${imported.specifier}`);
    }

    if (
      imported.specifier.startsWith("@/types/compat/") &&
      !COMPATIBILITY_IMPORT_ALLOWLIST.has(relative)
    ) {
      violations.push(`${relative} imports compatibility type ${imported.specifier}`);
    }

    if (isScoringBoundary && imported.specifier.startsWith("@/types/compat/")) {
      violations.push(`${relative} imports compatibility scoring types ${imported.specifier}`);
    }

    if (
      isRoomAdapter &&
      (imported.specifier.startsWith("@/server/") ||
        imported.specifier.startsWith("@/features/") ||
        imported.specifier.startsWith("@/application/presentation/"))
    ) {
      violations.push(
        `${relative} imports forbidden room adapter dependency ${imported.specifier}`,
      );
    }

    if (
      isSupabaseGeneratedType(imported.specifier) &&
      !relative.startsWith(`lib${path.sep}supabase${path.sep}`) &&
      !relative.startsWith(`infrastructure${path.sep}supabase${path.sep}`)
    ) {
      violations.push(
        `${relative} imports Supabase generated types outside the persistence boundary`,
      );
    }

    if (
      isScoringBoundary &&
      (imported.specifier === "@/types/gameplay/practice" ||
        imported.specifier === "@/lib/scoringPractice" ||
        imported.specifier === "@/lib/scoring")
    ) {
      violations.push(`${relative} imports practice scoring through ${imported.specifier}`);
    }

    if (
      relative.startsWith(`infrastructure${path.sep}mock${path.sep}`) &&
      LEGACY_DATA_SOURCES.has(imported.specifier)
    ) {
      violations.push(`${relative} imports a legacy mock adapter directly`);
    }

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

    if (layer === "application" && isApplicationForbiddenImport(imported.specifier)) {
      violations.push(
        `${relative} imports framework or infrastructure dependency ${imported.specifier}`,
      );
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

    if (
      layer === "infrastructure" &&
      imported.specifier.startsWith("@/server/") &&
      !relative.startsWith(`infrastructure${path.sep}mock${path.sep}`)
    ) {
      violations.push(`${relative} imports server business logic ${imported.specifier}`);
    }

    if (
      (relative.startsWith(`app${path.sep}api${path.sep}`) ||
        relative.startsWith(`app${path.sep}actions${path.sep}`)) &&
      imported.specifier === "@/infrastructure/supabase/attempts/attemptCommands"
    ) {
      violations.push(`${relative} depends on concrete SupabaseAttemptCommands`);
    }
  }
}

const serverFacadeFiles = [
  "server/production-data-access.ts",
  "server/demo-data-access.ts",
  "server/production-room-members.ts",
];
for (const relative of serverFacadeFiles) {
  const facadePath = path.join(process.cwd(), relative);
  const facadeSource = await readFile(facadePath, "utf8");
  if (!/^import ["']server-only["'];/m.test(facadeSource)) {
    violations.push(`${relative} is missing the server-only marker`);
  }
  if (
    relative.endsWith("data-access.ts") &&
    !/import\s+\{\s*cache\s*\}\s+from\s+["']react["']/.test(facadeSource)
  ) {
    violations.push(`${relative} does not use React request memoization`);
  }
  if (
    relative === "server/production-data-access.ts" &&
    /@\/infrastructure\/mock\//.test(facadeSource)
  ) {
    violations.push(`${relative} imports mock infrastructure`);
  }
  if (
    relative === "server/production-room-members.ts" &&
    /@\/(?:infrastructure\/mock|data\/mock)\//.test(facadeSource)
  ) {
    violations.push(`${relative} imports mock infrastructure or data`);
  }
  if (
    relative === "server/demo-data-access.ts" &&
    /@\/infrastructure\/supabase\//.test(facadeSource)
  ) {
    violations.push(`${relative} imports production Supabase infrastructure`);
  }
}

for (const file of productionFiles) {
  const relative = path.relative(process.cwd(), file);
  if (!relative.startsWith(`server${path.sep}`)) continue;
  const source = await readFile(file, "utf8");
  if (relative === "server/demo-data-access.ts") continue;
  if (/@\/infrastructure\/mock\//.test(source) || /@\/data\/mock\//.test(source)) {
    violations.push(`${relative} imports mock composition or data`);
  }
}

for (const file of productionFiles) {
  const relative = path.relative(process.cwd(), file);
  const source = await readFile(file, "utf8");
  const isProductionRoute =
    relative.startsWith(`app${path.sep}salas${path.sep}`) ||
    relative.startsWith(`app${path.sep}desafios${path.sep}`) ||
    relative.startsWith(`app${path.sep}admin${path.sep}`);
  const isDemoRoute = relative.startsWith(`app${path.sep}flash-pop${path.sep}`);
  if (isProductionRoute && source.includes("@/server/demo-data-access")) {
    violations.push(`${relative} imports the demo server facade`);
  }
  if (isDemoRoute && source.includes("@/server/production-data-access")) {
    violations.push(`${relative} imports the production server facade`);
  }
}

const attemptCommandsPort = path.join(process.cwd(), "application", "ports", "attempt-commands.ts");
const attemptCommandsSource = await readFile(attemptCommandsPort, "utf8");
for (const forbidden of [
  "invalidate(",
  "adjust(",
  "AdministrativeResult",
  "InvalidateAttemptCommand",
  "AdjustResultCommand",
]) {
  if (attemptCommandsSource.includes(forbidden)) {
    violations.push(
      `application/ports/attempt-commands.ts contains administrative contract ${forbidden}; use SuperadminAttemptCommands`,
    );
  }
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
