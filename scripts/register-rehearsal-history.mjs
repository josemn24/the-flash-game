import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { repositoryRehearsalQuestions } from "./support/rehearsal-catalog.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}

/** Append references only. Existing entries must still exist with their original full hash. */
export function appendRehearsalHistory(questions, previous) {
  const references = questions.map((q) => ({
    id: q.id,
    version: q.version,
    contentHash: createHash("sha256")
      .update(JSON.stringify(canonical(q)))
      .digest("hex"),
  }));
  const key = (q) => `${q.id}@${q.version}`;
  const current = new Map(references.map((q) => [key(q), q]));
  if (current.size !== references.length) throw new Error("duplicate_question_version");
  const recorded = new Set(previous.map(key));
  if (recorded.size !== previous.length) throw new Error("duplicate_history_reference");
  for (const ref of previous)
    if (current.get(key(ref))?.contentHash !== ref.contentHash)
      throw new Error(`historical_version_missing_or_changed:${key(ref)}`);
  const additions = references
    .filter((q) => !recorded.has(key(q)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.version - b.version));
  return [...previous, ...additions];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = "test-utils/rehearsals/history-fingerprints.json";
  const previous = JSON.parse(readFileSync(path, "utf8"));
  const next = appendRehearsalHistory(repositoryRehearsalQuestions(), previous);
  writeFileSync(path, JSON.stringify(next, null, 2) + "\n");
  console.log(
    `Historial: ${previous.length} referencias conservadas; ${next.length - previous.length} añadidas.`,
  );
}
