import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "infrastructure/rehearsals/bank.test.ts",
    "infrastructure/rehearsals/editorial.test.ts",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, REHEARSAL_COVERAGE_REPORT: "output/rehearsal-coverage.json" },
  },
);
process.exitCode = result.status ?? 1;

if (result.status === 0) console.log("Informe de cobertura: output/rehearsal-coverage.json");
