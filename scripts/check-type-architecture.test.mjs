import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
let fixtureRoot;

beforeAll(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "flash-type-architecture-"));
});

afterAll(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

async function runChecker() {
  return execFileAsync("node", ["scripts/check-type-architecture.mjs"], {
    cwd: projectRoot,
    env: { ...process.env, ARCHITECTURE_FIXTURE_ROOT: fixtureRoot },
  });
}

async function expectCheckerFailure(relativePath, source, message) {
  const fixturePath = path.join(fixtureRoot, relativePath);
  await mkdir(path.dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, source);
  try {
    await expect(runChecker()).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining(message),
    });
  } finally {
    await rm(fixturePath, { force: true });
  }
}

describe("type architecture boundary checker", () => {
  it.each([
    ["components", 'import { isAuthError } from "@supabase/supabase-js";', "@supabase/supabase-js"],
    ["features", 'import { createBrowserClient } from "@supabase/ssr";', "@supabase/ssr"],
    [
      "components",
      'import { createClient } from "@/infrastructure/supabase/auth/server-client";',
      "@/infrastructure/supabase/auth/server-client",
    ],
    [
      "components",
      'import { createClient } from "../infrastructure/supabase/auth/server-client";',
      "../infrastructure/supabase/auth/server-client",
    ],
    [
      "components",
      'export { createClient } from "@/infrastructure/supabase/auth/server-client";',
      "@/infrastructure/supabase/auth/server-client",
    ],
    ["features", 'const sdk = import("@supabase/supabase-js");', "@supabase/supabase-js"],
    [
      "app",
      '"use client";\nimport { createClient } from "@/infrastructure/supabase/auth/server-client";',
      "@/infrastructure/supabase/auth/server-client",
    ],
    [
      "app",
      '"use server";\nimport { createClient } from "@/infrastructure/supabase/auth/server-client";',
      "@/infrastructure/supabase/auth/server-client",
    ],
    [
      "components",
      'import type { AuthError } from "@supabase/supabase-js";',
      "@supabase/supabase-js",
    ],
  ])("rejects provider dependencies in %s: %s", async (layer, source, specifier) => {
    const file = `${layer}/__architecture-authentication-test__.ts`;
    await expectCheckerFailure(file, source, `${file} exposes Supabase to UI via ${specifier}`);
  });

  it("keeps the pure lib boundary from importing server modules", async () => {
    await expectCheckerFailure(
      "lib/__architecture-server-boundary-test__.ts",
      'import { logHttpEvent } from "@/server/observability";\n\nvoid logHttpEvent;\n',
      "lib/__architecture-server-boundary-test__.ts crosses a client-safe boundary via @/server/observability",
    );
  });

  it("allows Supabase infrastructure to use infrastructure observability", async () => {
    const fixturePath = path.join(
      fixtureRoot,
      "infrastructure",
      "supabase",
      "__architecture-observability-test__.ts",
    );
    await mkdir(path.dirname(fixturePath), { recursive: true });
    await writeFile(
      fixturePath,
      'import { logHttpEvent } from "@/infrastructure/observability/http";\n\nvoid logHttpEvent;\n',
    );
    try {
      await expect(runChecker()).resolves.toMatchObject({
        stdout: expect.stringContaining("Type architecture OK"),
      });
    } finally {
      await rm(fixturePath, { force: true });
    }
  });

  it("fails when a production route imports the demo facade", async () => {
    await expectCheckerFailure(
      "app/__architecture-boundary-test__.ts",
      'import { getFlashPopLobbyPageModel } from "@/server/demo-data-access";\n\nvoid getFlashPopLobbyPageModel;\n',
      "app/__architecture-boundary-test__.ts imports the demo server facade outside app/demo",
    );
  });

  it("allows the demo facade inside app/demo", async () => {
    const fixturePath = path.join(fixtureRoot, "app", "demo", "__architecture-boundary-test__.ts");
    await mkdir(path.dirname(fixturePath), { recursive: true });
    await writeFile(
      fixturePath,
      'import { getFlashPopLobbyPageModel } from "@/server/demo-data-access";\n\nvoid getFlashPopLobbyPageModel;\n',
    );
    try {
      await expect(runChecker()).resolves.toMatchObject({
        stdout: expect.stringContaining("Type architecture OK"),
      });
    } finally {
      await rm(fixturePath, { force: true });
    }
  });

  it("fails when a production route imports the retired mixed game barrel", async () => {
    await expectCheckerFailure(
      "app/__architecture-barrel-test__.ts",
      'import { GameApp } from "@/components/game";\n\nvoid GameApp;\n',
      "app/__architecture-barrel-test__.ts imports the retired mixed game barrel",
    );
  });

  it("fails when a production route imports a legacy type barrel", async () => {
    await expectCheckerFailure(
      "app/__architecture-legacy-type-test__.ts",
      'import type { Challenge } from "@/types/game";\n\nvoid (null as Challenge | null);\n',
      "app/__architecture-legacy-type-test__.ts imports legacy type barrel @/types/game",
    );
  });

  it("fails when a competitive route enables mock persistence", async () => {
    await expectCheckerFailure(
      "app/salas/__architecture-persistence-test__.ts",
      'const model = { persistence: "mock" };\n\nvoid model;\n',
      "app/salas/__architecture-persistence-test__.ts enables mock persistence in a competitive route",
    );
  });

  it("fails when a production route bypasses the production game barrel", async () => {
    await expectCheckerFailure(
      "app/__architecture-production-barrel-test__.ts",
      'import { RoomChallengeClient } from "@/components/game/RoomChallengeClient.client";\n\nvoid RoomChallengeClient;\n',
      "app/__architecture-production-barrel-test__.ts imports RoomChallengeClient directly",
    );
  });

  it("fails when a production route imports mock data", async () => {
    await expectCheckerFailure(
      "app/desafios/__architecture-mock-data-test__.ts",
      'import { mockDomainStore } from "@/data/mock/store";\n\nvoid mockDomainStore;\n',
      "app/desafios/__architecture-mock-data-test__.ts imports mock data or infrastructure from a production route",
    );
  });

  it("keeps administrative Supabase adapters inside the admin composition", async () => {
    await expectCheckerFailure(
      "server/admin-architecture-test.ts",
      'import { supabaseSuperadminPortalQueries } from "@/infrastructure/supabase/admin/superadminQueries";\n\nvoid supabaseSuperadminPortalQueries;\n',
      "server/admin-architecture-test.ts imports administrative infrastructure directly; use server/composition/admin",
    );
  });

  it("fails when a demo route imports the production game barrel", async () => {
    await expectCheckerFailure(
      "app/demo/__architecture-production-surface-test__.ts",
      'import { RoomChallengeClient } from "@/components/game/production";\n\nvoid RoomChallengeClient;\n',
      "app/demo/__architecture-production-surface-test__.ts imports a non-demo game barrel from a demo route",
    );
  });
});

describe("question input context boundaries", () => {
  it.each([
    [
      "PracticeInput",
      'import type { CompetitiveInput } from "@/features/question-formats/competitiveInputTypes";',
    ],
    ["PracticeInput", 'export { render } from "../mini-wordle/input";'],
    ["input", 'import type { PracticeInput } from "../../practiceInputTypes";'],
    ["input", 'const renderer = import("../mini-wordle/PracticeInput");'],
  ])("rejects %s importing another input context", async (adapter, source) => {
    const directory = "features/question-formats/formats/__architecture-context-test__";
    const fixtureDirectory = path.join(fixtureRoot, directory);
    await mkdir(fixtureDirectory, { recursive: true });
    try {
      await expectCheckerFailure(
        path.join(directory, `${adapter}.tsx`),
        source,
        "crosses question input contexts",
      );
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("allows both contexts to use a neutral view and shared algorithms", async () => {
    const directory = "features/question-formats/formats/__architecture-context-test__";
    const fixtureDirectory = path.join(fixtureRoot, directory);
    await mkdir(fixtureDirectory, { recursive: true });
    try {
      for (const adapter of ["PracticeInput", "input"]) {
        await writeFile(
          path.join(fixtureDirectory, `${adapter}.tsx`),
          'export { ShortTextInput } from "../short-text/ShortTextInput";\nexport { normalizeMiniWordleWord } from "@/lib/miniWordle";\n',
        );
      }
      await expect(runChecker()).resolves.toMatchObject({
        stdout: expect.stringContaining("Type architecture OK"),
      });
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });
});

describe("shared Pyramid session boundaries", () => {
  it("rejects references to the retired controller", async () => {
    await expectCheckerFailure(
      "features/__architecture-pyramid-retired-test__.ts",
      'import { usePyramidSession } from "@/features/pyramid/usePyramidSession";\nvoid usePyramidSession;',
      "imports a retired Pyramid implementation",
    );
  });
  it("rejects a recreated legacy controller file", async () => {
    await expectCheckerFailure(
      "features/pyramid/usePyramidSession.ts",
      "export const usePyramidSession = () => null;",
      "reintroduces a retired Pyramid implementation",
    );
  });
  it("rejects private local definitions in a remote composition", async () => {
    await expectCheckerFailure(
      "components/game/modes/flash-pop/ServerArchitecturePyramid.client.tsx",
      'import type { LocalPyramidDefinition } from "@/types/gameplay/local-pyramid";\nexport type Input = LocalPyramidDefinition;',
      "imports private local session data",
    );
  });
});
