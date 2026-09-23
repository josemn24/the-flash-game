import { readFile } from "node:fs/promises";
import path from "node:path";
import { dockerSql, sqlString } from "./support/supabase-local.mjs";

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

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
) {
  await loadMiniWordleDictionary();
  console.log("Diccionario Mini-Wordle cargado en PostgreSQL local.");
}
