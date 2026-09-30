import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const outputPath = path.join(projectRoot, "lib", "supabase", "database.types.ts");

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function generate() {
  try {
    const { stdout } = await execFileAsync(
      npmCommand(),
      ["exec", "--", "supabase", "gen", "types", "typescript", "--local", "--schema", "public"],
      {
        cwd: projectRoot,
        env: { ...process.env, SUPABASE_TELEMETRY: "false" },
        maxBuffer: 50 * 1024 * 1024,
      },
    );
    return stdout;
  } catch (error) {
    throw new Error(
      "No se pudieron generar los tipos de Supabase. Comprueba que Supabase local está iniciado y que el esquema public está actualizado.",
      { cause: error },
    );
  }
}

async function checkGeneratedTypes(contents) {
  let current;
  try {
    current = await readFile(outputPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `No existe ${path.relative(projectRoot, outputPath)}. Ejecuta npm run supabase:types.`,
      );
    }
    throw error;
  }

  if (current !== contents) {
    throw new Error(
      `${path.relative(projectRoot, outputPath)} no coincide con Supabase local. Ejecuta npm run supabase:types y revisa el diff.`,
    );
  }
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const contents = await generate();

  if (checkOnly) {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "flash-game-supabase-types-"));
    const temporaryPath = path.join(temporaryDirectory, "database.types.ts");
    try {
      await writeFile(temporaryPath, contents, "utf8");
      await checkGeneratedTypes(await readFile(temporaryPath, "utf8"));
      console.log("Supabase generated types are up to date.");
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
    return;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, contents, "utf8");
  console.log(`Generated ${path.relative(projectRoot, outputPath)} from Supabase public.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
