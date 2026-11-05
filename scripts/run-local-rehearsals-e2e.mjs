import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const distDir = ".next/local-rehearsals-e2e";
const env = {
  ...process.env,
  FLASH_NEXT_DIST_DIR: distDir,
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_DB_URL: "",
};
const savedConfig = await readFile("tsconfig.json", "utf8");
const savedNextEnv = await readFile("next-env.d.ts", "utf8").catch(() => "");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`${command} terminó con ${signal ?? code}`)),
    );
  });
}

try {
  await run("npx", [
    "playwright",
    "test",
    "--config",
    "playwright.local-rehearsals.config.ts",
    ...process.argv.slice(2),
  ]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  const current = JSON.parse(await readFile("tsconfig.json", "utf8"));
  const original = JSON.parse(savedConfig);
  current.include = current.include.filter((entry) => !entry.startsWith(`${distDir}/`));
  await writeFile(
    "tsconfig.json",
    JSON.stringify(current) === JSON.stringify(original)
      ? savedConfig
      : `${JSON.stringify(current, null, 2)}\n`,
  );
  const nextEnv = await readFile("next-env.d.ts", "utf8").catch(() => "");
  const originalImport = savedNextEnv.match(/^import .*routes\.d\.ts.*;$/m)?.[0];
  if (originalImport && nextEnv.includes(`./${distDir}/`))
    await writeFile(
      "next-env.d.ts",
      nextEnv.replace(/^import .*routes\.d\.ts.*;$/m, originalImport),
    );
}
