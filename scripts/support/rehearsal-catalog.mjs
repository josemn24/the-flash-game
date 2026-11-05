import { readFileSync, readdirSync } from "node:fs";
/** Test/CLI access only. Runtime uses the server-only bank adapter. */
export function repositoryRehearsalQuestions() {
  return readdirSync("data/rehearsals/bank")
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(`data/rehearsals/bank/${f}`, "utf8")));
}
