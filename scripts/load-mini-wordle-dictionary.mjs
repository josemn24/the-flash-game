import { readFile } from "node:fs/promises";
import path from "node:path";
import { dockerSql, sqlString } from "./support/supabase-local.mjs";
import { fileURLToPath } from "node:url";
import {
  loadOperationalEnv,
  parseEnvironmentArgs,
  resolveEnvironment,
  withEnvironmentSql,
} from "./support/supabase-environment.mjs";

function insertStatements(dictionaryId, wordLength, words) {
  const statements = [];
  for (let offset = 0; offset < words.length; offset += 500) {
    const values = words
      .slice(offset, offset + 500)
      .map((word) => `(${sqlString(dictionaryId)}, ${wordLength}, ${sqlString(word)})`)
      .join(",\n");
    statements.push(
      `insert into private.mini_wordle_dictionary_words(dictionary_id, word_length, word) values\n${values}\non conflict (dictionary_id, word) do nothing;`,
    );
  }
  return statements;
}

export async function loadMiniWordleDictionary({ runSql = dockerSql, root = process.cwd() } = {}) {
  const dictionaryFiles = [4, 5].map((length) =>
    path.join(root, "public", "dictionaries", `es-general-${length}.v1.json`),
  );
  const inserts = [];
  for (const file of dictionaryFiles) {
    const payload = JSON.parse(await readFile(file, "utf8"));
    inserts.push(...insertStatements(`${payload.id}.v1`, payload.wordLength, payload.words));
  }
  await runSql(
    [
      "begin;",
      ...inserts,
      "commit;",
      "select dictionary_id, count(*) from private.mini_wordle_dictionary_words group by dictionary_id order by dictionary_id;",
    ].join("\n"),
  );
}

export async function verifyMiniWordleDictionaries(sql, root = process.cwd()) {
  const expected = await Promise.all(
    [4, 5].map(async (length) => {
      const payload = JSON.parse(
        await readFile(
          path.join(root, "public", "dictionaries", `es-general-${length}.v1.json`),
          "utf8",
        ),
      );
      return {
        id: `${payload.id}.v1`,
        length: payload.wordLength,
        count: new Set(payload.words).size,
      };
    }),
  );
  const actual = JSON.parse(
    await sql(`select coalesce(jsonb_agg(row order by row.id), '[]'::jsonb) from (
    select dictionary_id as id, min(word_length) as length, count(*) as count
    from private.mini_wordle_dictionary_words group by dictionary_id) row;`),
  );
  const normalized = actual.map(({ id, length, count }) => ({ id, length, count }));
  if (JSON.stringify(normalized) !== JSON.stringify(expected))
    throw new Error("Los diccionarios cargados no coinciden con sus archivos canónicos.");
  return actual;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseEnvironmentArgs(
    args.includes("--target") ? args : ["--target", "local", ...args],
  );
  loadOperationalEnv(options);
  const config = await resolveEnvironment(options.target);
  if (options.dryRun) {
    console.log(
      JSON.stringify({
        dryRun: true,
        target: config.target,
        projectRef: config.projectRef,
        dictionaries: ["es-general-4.v1", "es-general-5.v1"],
      }),
    );
    return;
  }
  const dictionaries = await withEnvironmentSql(config, async (sql) => {
    await loadMiniWordleDictionary({ runSql: sql });
    return verifyMiniWordleDictionaries(sql);
  });
  console.log(
    JSON.stringify({ target: config.target, projectRef: config.projectRef, dictionaries }),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
