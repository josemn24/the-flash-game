-- Allow the active attempt owner to resolve the private asset needed by gameplay.
begin;
set local check_function_bodies = off;

create or replace function private.read_competitive_question_asset(input jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.command_actor(); result jsonb;
begin
  select jsonb_build_object('assetId', asset.id, 'objectPath', asset.object_path, 'status', asset.status)
    into result
  from public.attempts attempt
  join private.challenge_items item on item.challenge_version_id = attempt.challenge_version_id
  join private.question_versions question on question.id = item.question_version_id
  join private.media_assets asset on asset.id = coalesce(
    question.public_payload->'surface'->>'assetId',
    question.public_payload->'media'->>'assetId'
  )::uuid
  where attempt.id = (input->>'attemptId')::uuid
    and attempt.kind = 'competitive'
    and (
      attempt.player_id = actor
      or private.can_review_competitive_attempt(attempt.id)
    )
    and item.question_version_id is not null
    and question.payload_schema_version = 2
    and (
      (question.type = 'progressive-image' and question.public_payload->'surface' ? 'assetId')
      or (question.type = 'multiple-choice' and question.public_payload->'media' ? 'assetId')
      or (question.type = 'estimation' and question.public_payload->'media' ? 'assetId')
      or (question.type = 'heat-map' and question.public_payload->'surface' ? 'assetId')
    )
    and asset.kind = 'question-asset' and asset.status in ('ready','archived')
    and asset.id = (input->>'assetId')::uuid;
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
exception when invalid_text_representation then raise exception 'not_authorized' using errcode = '42501';
end;
$$;

alter function private.read_competitive_question_asset(jsonb) owner to postgres;
revoke all on function private.read_competitive_question_asset(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.read_competitive_question_asset(jsonb) to service_role;

commit;
