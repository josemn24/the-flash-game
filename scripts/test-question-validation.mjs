import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadFormatContractFixtures } from "./test-format-contracts.mjs";

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${literal(JSON.stringify(value))}::jsonb`;

function characterizationCases(corpus) {
  const cases = [];
  const question = (id, document, sqlNull = false) =>
    cases.push({ id: `question/${id}`, kind: "question", document, sqlNull });
  const published = (id, document, status = "published", omitSolution = false) =>
    cases.push({ id: `eligibility/${id}`, kind: "eligibility", document, status, omitSolution });
  const challenge = (id, document) =>
    cases.push({ id: `challenge/${id}`, kind: "challenge", document });

  for (const entry of corpus) {
    question(entry.id, entry.document);
    published(entry.id, entry.document);
  }
  question("sql-null", null, true);
  question("json-null", null);
  question("array", []);
  question("scalar", "question");
  question("empty-object", {});
  challenge("json-null", null);
  challenge("empty-object", {});

  // One canonical example per format/version; aliases remain covered by the corpus.
  const canonical = new Map();
  for (const entry of corpus.filter((entry) => entry.valid)) {
    const key = `${entry.document.type}-v${entry.document.payloadSchemaVersion}`;
    if (!canonical.has(key)) canonical.set(key, entry.document);
  }
  for (const [id, document] of canonical) {
    for (const field of [
      "slug",
      "type",
      "payloadSchemaVersion",
      "timeLimitMs",
      "publicPayload",
      "solutionPayload",
    ]) {
      const missing = structuredClone(document);
      delete missing[field];
      question(`${id}/missing-${field}`, missing);
    }
    for (const [name, changes] of Object.entries({
      "null-type": { type: null },
      "unknown-type": { type: "unknown-format" },
      "extra-field": { unexpected: true },
      "inline-points": { points: 50 },
      "fractional-time": { timeLimitMs: 1.5 },
      "negative-time": { timeLimitMs: -1 },
      "invalid-time-cast": { timeLimitMs: "not-a-number" },
      "invalid-version-cast": { payloadSchemaVersion: "not-a-number" },
      "multiple-errors": { slug: "", publicPayload: null, solutionPayload: null },
      "payload-and-solution-errors": { publicPayload: {}, solutionPayload: {} },
    }))
      question(`${id}/${name}`, { ...document, ...changes });
    published(`${id}/draft`, document, "draft");
    published(`${id}/archived`, document, "archived");
    published(`${id}/missing-solution`, document, "published", true);
    published(`${id}/empty-public`, { ...document, publicPayload: {} });
    published(`${id}/empty-solution`, { ...document, solutionPayload: {} });
    published(`${id}/unknown-version`, { ...document, payloadSchemaVersion: 999 });
  }
  const choice = canonical.get("multiple-choice-v1");
  published("nonexistent", choice, "nonexistent");
  published("practice-only", { ...choice, type: "image-labeling" });
  const image = canonical.get("multiple-choice-v2");
  for (const status of ["ready", "pending", "archived"]) {
    cases.push({ id: `eligibility/asset-${status}`, kind: "asset", document: image, status });
    cases.push({ id: `question/asset-${status}`, kind: "asset-question", document: image, status });
  }

  // Characterize the orchestration separately from each question validator.
  const header = (mode) => ({
    slug: "validation-characterization",
    title: "Validation",
    subtitle: "",
    description: "",
    mode,
    configSchemaVersion: 1,
    modeConfig: mode === "survival" ? { lives: 1 } : {},
    ...(mode === "alphabet" ? { globalTimeLimitMs: 60000 } : {}),
  });
  for (const mode of ["flash", "survival", "narrative", "pyramid"]) {
    const count = mode === "pyramid" ? 7 : 2;
    const questions = Array.from({ length: count }, (_, index) => ({
      ...choice,
      slug: `question-${index}`,
      points: count === 7 ? (index < 5 ? 14 : 15) : 50,
      ...(mode === "pyramid"
        ? {
            modeConfig: {
              levelId: `level-${index}`,
              label: `Level ${index}`,
              briefing: {
                title: "Briefing",
                format: "Multiple choice",
                description: "Answer the question.",
              },
            },
          }
        : {}),
    }));
    const document = { challenge: header(mode), questions };
    challenge(`${mode}/valid`, document);
    challenge(`${mode}/wrong-count`, { ...document, questions: questions.slice(0, 1) });
    challenge(`${mode}/wrong-total`, {
      ...document,
      questions: questions.map((q) => ({ ...q, points: 1 })),
    });
    challenge(`${mode}/duplicate-slug`, {
      ...document,
      questions: questions.map((q) => ({ ...q, slug: "same" })),
    });
    challenge(`${mode}/multiple-errors`, {
      ...document,
      challenge: { ...document.challenge, title: "" },
      questions: [],
    });
  }
  for (const mode of ["alphabet", "survival", "pyramid"]) {
    const count = mode === "pyramid" ? 7 : 2;
    const document = {
      challenge: header(mode),
      questions: Array.from({ length: count }, (_, index) => ({
        source: "library",
        questionVersionId: "__CHOICE_VERSION__",
        points: count === 7 ? (index < 5 ? 14 : 15) : 50,
        modeConfig:
          mode === "alphabet"
            ? { letter: String.fromCharCode(65 + index) }
            : mode === "pyramid"
              ? {
                  levelId: `level-${index}`,
                  label: `Level ${index}`,
                  briefing: { title: "Briefing", format: "Choice", description: "Answer." },
                }
              : {},
      })),
    };
    challenge(`${mode}/duplicate-reference`, document);
  }
  return cases;
}

// Each observation runs in a subtransaction: failures and asset mutations cannot
// contaminate the next case. SQL NULL is serialized as null, never coalesced to false.
export async function observeQuestionValidation(sql) {
  const { cases: corpus, fixtures } = await loadFormatContractFixtures();
  const cases = characterizationCases(corpus);
  const checks = cases
    .map(
      (entry) => `select jsonb_build_array(${literal(entry.id)}, pg_temp.observe_validation(
    ${literal(entry.kind)}, ${entry.sqlNull ? "null::jsonb" : json(entry.document)},
    ${literal(entry.status ?? "published")}, ${Boolean(entry.omitSolution)}));`,
    )
    .join("\n");
  const result = await sql(`begin;
${fixtures}
create function pg_temp.observe_validation(kind text, document jsonb, target_status text, omit_solution boolean)
returns jsonb language plpgsql as $$
declare definition uuid := gen_random_uuid(); version uuid := gen_random_uuid(); supported boolean; asset uuid;
begin
  begin
    if kind in ('asset', 'asset-question') then
      asset := (document->'publicPayload'->'media'->>'assetId')::uuid;
      update private.media_assets set status = target_status,
        archived_at = case when target_status = 'archived' then clock_timestamp() end where id = asset;
      kind := case when kind = 'asset-question' then 'question' else 'eligibility' end;
      target_status := 'published';
    end if;
    if kind = 'question' then
      perform private.validate_flash_question_document(document);
      supported := true;
    elsif kind = 'challenge' then
      document := replace(document::text, '__CHOICE_VERSION__', test_support.id('qv-pyramid-1')::text)::jsonb;
      perform private.validate_flash_editorial_document(document);
      supported := true;
    else
      if target_status = 'nonexistent' then
        supported := private.is_supported_flash_question(version);
      else
        insert into private.question_definitions(id,slug,created_by_player_id)
          values(definition,definition::text,test_support.id('superadmin'));
        insert into private.question_versions(id,question_definition_id,version_number,payload_schema_version,type,time_limit_ms,public_payload,created_by_player_id)
          values(version,definition,1,(document->>'payloadSchemaVersion')::integer,document->>'type',
            (document->>'timeLimitMs')::integer,document->'publicPayload',test_support.id('superadmin'));
        if not omit_solution then
          insert into private.question_version_solutions(question_version_id,solution_payload)
            values(version,document->'solutionPayload');
        end if;
        if target_status <> 'draft' then
          update private.question_versions set status = 'published', published_at = clock_timestamp() where id = version;
        end if;
        if target_status = 'archived' then
          update private.question_versions set status = 'archived' where id = version;
        end if;
        supported := private.is_supported_flash_question(version);
      end if;
    end if;
    -- Roll back successful observations too, while carrying the result out.
    raise exception using errcode = 'ZX001', message = 'observation_complete';
  exception
    when sqlstate 'ZX001' then return jsonb_build_array(supported, null, null);
    when others then return jsonb_build_array(false, sqlstate, sqlerrm);
  end;
end;
$$;
${checks}
rollback;`);
  const observations = result
    .split("\n")
    .filter((line) => line.startsWith("["))
    .map((line) => {
      const [id, outcome] = JSON.parse(line);
      return [id, ...outcome];
    });
  assert.equal(observations.length, cases.length, "Missing SQL characterization observations");
  assert.equal(
    new Set(observations.map(([id]) => id)).size,
    cases.length,
    "Duplicate characterization IDs",
  );
  return observations;
}

export async function testQuestionValidation(sql) {
  const expected = JSON.parse(
    await readFile("test-utils/format-contracts/sql-validation-baseline.json", "utf8"),
  );
  const actual = await observeQuestionValidation(sql);
  assert.deepEqual(
    actual,
    expected.observations,
    "SQL validation behavior changed from the pre-refactor baseline",
  );
  console.log(
    `SQL validation characterization: ${actual.length} observations passed (acceptance, NULL, SQLSTATE and errors).`,
  );
}
