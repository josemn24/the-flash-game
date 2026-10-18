import { readFileSync } from "node:fs";
import path from "node:path";
import { sessionFixture } from "./competitive-session-fixture.mjs";
import { uploadStorageObject } from "../../support/supabase-local.mjs";

const corpus = JSON.parse(
  readFileSync(
    new URL("../../../test-utils/format-contracts/corpus.json", import.meta.url),
    "utf8",
  ),
);
const seen = new Set();
const cases = corpus.filter((row) => {
  const key = `${row.document.type}:${row.document.payloadSchemaVersion}`;
  if (!row.valid || !row.modes.includes("pyramid") || seen.has(key)) return false;
  seen.add(key);
  return true;
});
const queen = cases.find((row) => row.document.type === "queens");
const publications = [
  ...cases,
  ...[1, 2].map((failures) => ({ ...queen, id: `queens-after-${failures}` })),
  ...["mini-wordle", "progressive-clues"].map((type) => ({
    ...cases.find((row) => row.document.type === type),
    id: `${type}-after-one`,
  })),
];
const assets = new Map();
function collect(value) {
  if (!value || typeof value !== "object") return;
  if (typeof value.assetId === "string") assets.set(value.assetId, value);
  Object.values(value).forEach(collect);
}
cases.forEach((c) => collect(c.document.publicPayload));
function sample(test) {
  return sessionFixture({
    id: `conformance-${test.id}`,
    mode: "pyramid",
    title: `Conformidad ${test.id}`,
    questions: Array.from({ length: 7 }, (_, index) => {
      const document = index === 0 ? test.document : cases[0].document;
      return {
        type: document.type,
        payloadSchemaVersion: document.payloadSchemaVersion,
        timeLimitMs: document.timeLimitMs,
        points: index === 6 ? 16 : 14,
        publicPayload: document.publicPayload,
        solution: document.solutionPayload,
        modeConfig: {
          levelId: `level-${index}`,
          label: `Nivel ${index + 1}`,
          briefing: {
            title: `Nivel ${index + 1}`,
            format: document.type,
            description: "Contrato funcional",
          },
        },
      };
    }),
  });
}
const scenario = {
  id: "pyramid-session-conformance",
  namespace: "the-flash-game:pyramid-session-conformance",
  users: ["alice", "bob", "carol", "dave", "erin", "frank", "grace"].map((label) => ({
    label,
    displayName: `Conformidad ${label}`,
  })),
  buildDomainSql(context) {
    const quote = context.sqlString;
    const assetSql = [...assets]
      .map(
        ([id, a]) =>
          `insert into private.media_assets(id,bucket_id,object_path,kind,status,created_by_player_id,mime_type,byte_size,width,height,sha256) values (${quote(id)},'question-assets',${quote(`question-assets/${id}.png`)},'question-asset','ready',${quote(context.accounts.alice.playerId)},'image/png',1,${a.width},${a.height},${quote("0".repeat(64))});`,
      )
      .join("\n");
    return (
      `${assetSql}\ninsert into private.mini_wordle_dictionary_words(dictionary_id,word_length,word) values ('es-general-5.v1',5,'CASAS');\n` +
      publications
        .map((test) =>
          sample(test).buildDomainSql({
            ...context,
            sqlUuid: (key) => context.sqlUuid(`${test.id}:${key}`),
          }),
        )
        .join("\n")
    );
  },
  async seedStorage({ config }) {
    for (const [id] of assets)
      await uploadStorageObject(config, {
        bucket: "question-assets",
        objectPath: `question-assets/${id}.png`,
        filePath: path.resolve("public/visuals/connections/eiffel-tower.png"),
        contentType: "image/png",
      });
  },
  manifest({ stableId }) {
    return {
      cases: Object.fromEntries(
        publications.map((test) => [
          test.id,
          {
            publicationId: stableId(`${test.id}:publication`),
            seasonId: stableId(`${test.id}:season`),
            challengeVersionId: stableId(`${test.id}:challenge-version`),
            itemIds: Array.from({ length: 7 }, (_, i) => stableId(`${test.id}:item-${i}`)),
            questionIds: Array.from({ length: 7 }, (_, i) => stableId(`${test.id}:version-${i}`)),
          },
        ]),
      ),
    };
  },
};
export default scenario;
