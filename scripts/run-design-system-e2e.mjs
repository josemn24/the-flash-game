import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const production = process.argv.includes("--production");
const mode = production ? "production" : "development";
const distDir = `.next/design-system-${mode}`;
const env = {
  ...process.env,
  DESIGN_SYSTEM_E2E_MODE: mode,
  FLASH_NEXT_DIST_DIR: distDir,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
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
  if (production) await run("npm", ["run", "build"]);
  await run("npx", [
    "playwright",
    "test",
    "--config",
    "playwright.design-system.config.ts",
    ...process.argv.slice(2).filter((arg) => arg !== "--production"),
  ]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  // Next adds the selected distDir to its generated route includes. Preserve unrelated edits.
  const current = JSON.parse(await readFile("tsconfig.json", "utf8"));
  const original = JSON.parse(savedConfig);
  current.include = current.include.filter(
    (entry) => !entry.startsWith(`${distDir}/`) || original.include.includes(entry),
  );
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
