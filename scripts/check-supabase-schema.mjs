import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { checkInventory } from "./supabase-security-inventory.mjs";
import { testConcurrentCommands } from "./test-supabase-concurrency.mjs";
import { testFormatContracts } from "./test-format-contracts.mjs";
import { testQuestionValidation } from "./test-question-validation.mjs";
import { testSeasonMeasurementContract } from "./test-season-measurement-contract.mjs";
import { testCompletionHealthContract } from "./test-completion-health-contract.mjs";

import { testCalendarContract } from "./test-calendar-contract.mjs";
import { testAttemptContinuationContract } from "./test-attempt-continuation-contract.mjs";
import { testCheckpointContract } from "./test-checkpoint-contract.mjs";
import { testStagingBootstrapSql } from "./test-staging-bootstrap-sql.mjs";
import { testPyramidMigrationUpgrade } from "./test-pyramid-migration-upgrade.mjs";

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";
const sourceDirectory = process.argv.includes("--migrations")
  ? "supabase/migrations"
  : "supabase/schemas";
const database = `flash_schema_check_${randomUUID().replaceAll("-", "")}`;
const requestedTest = process.argv.find((argument) => argument.startsWith("--test="))?.slice(7);
function docker(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (data) => {
      out += data;
    });
    child.stderr.on("data", (data) => {
      err += data;
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${err}\n${out}`))));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
const sql = (input) =>
  docker(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], input);
let created = false;
async function withContractDatabase(run) {
  const contractDatabase = `flash_contract_${randomUUID().replaceAll("-", "")}`;
  await docker(["createdb", "-U", "postgres", contractDatabase]);
  try {
    const contractSql = (input) =>
      docker(
        ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", contractDatabase],
        input,
      );
    await contractSql(await readFile("supabase/tests/support/bootstrap.sql", "utf8"));
    await run(contractSql);
  } finally {
    await docker(["dropdb", "-U", "postgres", "--force", contractDatabase]);
  }
}
try {
  await docker(["createdb", "-U", "postgres", database]);
  created = true;
  await sql(await readFile("supabase/tests/support/bootstrap.sql", "utf8"));
  const files = (await readdir(sourceDirectory)).filter((name) => name.endsWith(".sql")).sort();
  const statements = await Promise.all(
    files.map((name) => readFile(`${sourceDirectory}/${name}`, "utf8")),
  );
  await sql(`begin;\n${statements.join("\n")}\ncommit;`);
  await checkInventory(sql);
  const stagingBootstrap = await testStagingBootstrapSql(sql);
  console.log(
    `Staging SQL bootstraps passed in both orders with repeats (${stagingBootstrap.orders.join("; ")}).`,
  );
  await testCompletionHealthContract(sql);
  await testSeasonMeasurementContract(sql);
  console.log(`Loaded ${files.length} files from ${sourceDirectory}; security inventory verified.`);
  for (const file of (await readdir("supabase/tests"))
    .filter((name) => name.endsWith(".test.sql") && (!requestedTest || name === requestedTest))
    .sort()) {
    let source = await readFile(`supabase/tests/${file}`, "utf8");
    for (const name of ["command", "regrade", "pyramid-queens", "time-trial", "question-library"]) {
      if (source.includes(`-- @${name}-fixtures`)) {
        const fixtures = await readFile(`supabase/tests/support/${name}-fixtures.sql`, "utf8");
        source = source.replace(`-- @${name}-fixtures`, () => fixtures);
      }
    }
    let result;
    try {
      result = await sql(source);
    } catch (error) {
      throw new Error(`${file}:\n${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
    if (/^not ok|^Bail out!|# Looks like you failed/m.test(result) || !/^1\.\.\d+/m.test(result))
      throw new Error(`${file}:\n${result}`);
    console.log(`${file}: ${result.match(/^1\.\.(\d+)/m)?.[1]} checks passed.`);
  }
  await testFormatContracts(sql);
  await testQuestionValidation(sql);
  await testConcurrentCommands(sql);
  // Committed race/recovery scenarios each need their own empty fixture namespace.
  for (const contract of [
    testCalendarContract,
    testCheckpointContract,
    testAttemptContinuationContract,
  ]) {
    await withContractDatabase(async (contractSql) => {
      await contractSql(`begin;\n${statements.join("\n")}\ncommit;`);
      await contract(contractSql);
      console.log(`${contract.name}: passed.`);
    });
  }
  if (sourceDirectory === "supabase/migrations") {
    await withContractDatabase((contractSql) =>
      testPyramidMigrationUpgrade(
        contractSql,
        files.map((name, index) => ({ name, source: statements[index] })),
      ),
    );
    console.log(
      "Pyramid upgrade preserved existing data; both v2 drafts were created through the portal command.",
    );
  }
  console.log("Concurrent command tests passed (independent PostgreSQL connections).");
} finally {
  if (created) await docker(["dropdb", "-U", "postgres", "--force", database]);
}
