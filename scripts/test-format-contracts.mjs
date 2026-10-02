import { readFile } from "node:fs/promises";

// The same JSON corpus is consumed by Vitest. SQL implementations stay independent.
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
export async function testFormatContracts(sql) {
  const cases = JSON.parse(await readFile("test-utils/format-contracts/corpus.json", "utf8"));
  const fixtures = await readFile("supabase/tests/support/command-fixtures.sql", "utf8");
  const assets = new Map();
  function collect(value) {
    if (!value || typeof value !== "object") return;
    if (typeof value.assetId === "string") assets.set(value.assetId, value);
    Object.values(value).forEach(collect);
  }
  cases.filter((test) => test.valid).forEach((test) => collect(test.document.publicPayload));
  const assetSql = [...assets]
    .map(
      ([id, asset]) =>
        `insert into private.media_assets(id,bucket_id,object_path,kind,status,created_by_player_id,mime_type,byte_size,width,height,sha256) values (${literal(id)},'question-assets',${literal(`question-assets/${id}.png`)},'question-asset','ready',test_support.id('superadmin'),'image/png',1,${asset.width},${asset.height},${literal("0".repeat(64))});`,
    )
    .join("\n");
  const checks = cases
    .map(
      (test) =>
        `select ${literal(test.id)}, pg_temp.contract_accepts(${literal(test.id)}, ${literal(JSON.stringify(test.document))}::jsonb, ${test.inline});`,
    )
    .join("\n");
  const result = await sql(`begin;\n${fixtures}\n${assetSql}
create temporary table format_contract_errors(id text,error text);
create function pg_temp.contract_accepts(case_id text, document jsonb, inline_document boolean) returns boolean language plpgsql as $$
declare definition uuid := gen_random_uuid(); version uuid := gen_random_uuid(); supported boolean; draft jsonb;
begin
  if inline_document then
    perform set_config('request.jwt.claims', jsonb_build_object('sub',test_support.id('auth-superadmin'),'role','authenticated','is_anonymous',false)::text,true);
    draft := public.create_superadmin_question_draft(jsonb_build_object(
      'idempotencyKey', gen_random_uuid()::text, 'reason', 'Shared contract conformance',
      'document', document || jsonb_build_object('slug',case_id)
    ));
    version := (draft->'versions'->0->>'questionVersionId')::uuid;
    perform public.publish_superadmin_question(jsonb_build_object(
      'idempotencyKey',gen_random_uuid()::text,'reason','Shared contract publication',
      'questionVersionId',version,'expectedUpdatedAt',draft->'versions'->0->>'updatedAt'
    ));
  else
    insert into private.question_definitions(id,slug,created_by_player_id) values(definition,definition::text,test_support.id('superadmin'));
    insert into private.question_versions(id,question_definition_id,version_number,payload_schema_version,type,time_limit_ms,public_payload,created_by_player_id)
      values(version,definition,1,(document->>'payloadSchemaVersion')::integer,document->>'type',(document->>'timeLimitMs')::integer,document->'publicPayload',test_support.id('superadmin'));
    insert into private.question_version_solutions(question_version_id,solution_payload) values(version,document->'solutionPayload');
    update private.question_versions set status='published',published_at=clock_timestamp() where id=version;
  end if;
  supported := private.is_supported_flash_question(version);
  return coalesce(supported,false);
exception when others then
  insert into format_contract_errors values(case_id,sqlstate || ': ' || sqlerrm);
  return false;
end;
$$;
${checks}
select 'diagnostic',id,error from format_contract_errors;
rollback;`);
  const actual = new Map(
    result
      .split("\n")
      .filter((line) => line.includes("|"))
      .map((line) => line.split("|")),
  );
  const failures = cases.filter((test) => actual.get(test.id) !== (test.valid ? "t" : "f"));
  if (failures.length)
    throw new Error(
      `Format SQL conformance failed: ${failures.map((test) => `${test.id}: expected ${test.valid}, received ${actual.get(test.id)}`).join("; ")}\n${result
        .split("\n")
        .filter(
          (line) =>
            line.startsWith("diagnostic|") &&
            failures.some((test) => line.split("|")[1] === test.id),
        )
        .join("\n")}`,
    );
  console.log(`Format SQL conformance: ${cases.length} shared cases passed.`);
}
