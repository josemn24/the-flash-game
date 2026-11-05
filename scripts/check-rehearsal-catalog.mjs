import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--reporter=dot",
    "infrastructure/rehearsals/bank.test.ts",
    "infrastructure/rehearsals/editorial.test.ts",
    "lib/rehearsals",
    "application/use-cases/rehearsals.test.ts",
    "app/admin/rehearsal-actions.test.ts",
    "components/admin/RehearsalManagement.client.test.tsx",
    "components/game/shells/RehearsalGameApp.test.tsx",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, REHEARSAL_COVERAGE_REPORT: "output/rehearsal-coverage.json" },
  },
);
process.exitCode = result.status ?? 1;

if (result.status === 0) console.log("Informe de cobertura: output/rehearsal-coverage.json");
