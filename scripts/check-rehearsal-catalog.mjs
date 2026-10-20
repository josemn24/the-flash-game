import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { repositoryRehearsals } from "./support/rehearsal-catalog.mjs";
const registry = repositoryRehearsals();
const content = JSON.parse(readFileSync("data/rehearsals/catalog.v1.json", "utf8"));
for (const [kind, entries] of [
  ["question", content.questions],
  ["rehearsal", content.rehearsals],
]) {
  const identities = new Set();
  for (const entry of entries) {
    assert.match(entry.id, /^[a-z0-9][a-z0-9-]{0,119}$/);
    assert.ok(Number.isSafeInteger(entry.version) && entry.version > 0);
    const identity = `${entry.id}@${entry.version}`;
    assert.ok(!identities.has(identity), `Duplicate ${kind}: ${identity}`);
    identities.add(identity);
  }
}
const manifest = JSON.parse(readFileSync("data/rehearsals/manifest.v1.json", "utf8"));
assert.deepEqual(
  registry.map((a) => a.ref),
  manifest,
  "Published rehearsal content changed without a new version",
);
function resources(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "src") {
      assert.equal(typeof child, "string");
      assert.ok(
        child.startsWith("/rehearsals/") && !child.includes(".."),
        "Rehearsal assets must belong to the repository",
      );
      assert.ok(existsSync(`public${child}`), `Missing rehearsal asset: ${child}`);
    } else resources(child);
  }
}
for (const artifact of registry) resources(artifact.source);
console.log(
  `Rehearsal catalog OK (${registry.length} immutable artifacts, repository assets present).`,
);
