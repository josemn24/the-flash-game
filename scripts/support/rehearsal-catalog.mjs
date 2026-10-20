import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { rehearsalCompatibility } from "../../lib/rehearsals/structure-core.mjs";

export function repositoryRehearsals() {
  const content = JSON.parse(readFileSync("data/rehearsals/catalog.v1.json", "utf8"));
  return content.rehearsals.map((template) => {
    const questions = template.items.map((item) => {
      const question = content.questions.find(
        (q) => q.id === item.questionId && q.version === item.questionVersion,
      );
      if (!question) throw new Error("rehearsal_question_missing");
      return { ...question, ...item };
    });
    return {
      ref: {
        id: template.id,
        version: template.version,
        contentHash: createHash("sha256")
          .update(JSON.stringify({ template, questions }))
          .digest("hex"),
      },
      source: {
        mode: template.mode,
        globalTimeLimitMs: template.globalTimeLimitMs,
        modeConfig: template.modeConfig,
        questions,
      },
    };
  });
}
export function rehearsalAssociationSql({ rehearsalId, versionId, source, actorPlayerId }) {
  const artifact = repositoryRehearsals().find((a) => a.ref.id === rehearsalId);
  if (!artifact || rehearsalCompatibility(source, artifact.source).length)
    throw new Error(`rehearsal_incompatible:${rehearsalId}`);
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  return `do $rehearsal$ declare snapshot jsonb; begin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', (select auth_user_id from public.players where id = ${quote(actorPlayerId)}::uuid), 'is_anonymous', false)::text, true);
    snapshot := private.read_editorial_rehearsal(${quote(versionId)}::uuid);
    perform private.set_challenge_rehearsal(jsonb_build_object(
      'challengeVersionId',${quote(versionId)},'expectedUpdatedAt',snapshot->>'updatedAt','sourceHash',snapshot->>'sourceHash',
      'idempotencyKey',${quote(`setup-rehearsal:${versionId}:${artifact.ref.contentHash}`)},'reason','Preparación explícita del ensayo de referencia',
      'ref',${quote(JSON.stringify(artifact.ref))}::jsonb));
  end $rehearsal$;`;
}
