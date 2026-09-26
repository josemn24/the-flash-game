-- S15 — server-evaluated competitive formats shared by Flash, Survival and Pyramid.
-- Every format in this allowlist is checked against the standalone editorial contract before admission.

create or replace function private.is_valid_published_competitive_question_format(
  target_question uuid,
  expected_type text
) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  question_row private.question_versions%rowtype;
begin
  if expected_type not in (
    'true-false', 'ordering', 'classification', 'logic-matrix',
    'zip', 'escape', 'word-hashtag', 'odd-one-out', 'connect-pairs'
  ) then
    return false;
  end if;
  select * into question_row
  from private.question_versions question
  where question.id = target_question;
  if not found or question_row.status <> 'published'
    or question_row.type <> expected_type or question_row.payload_schema_version <> 1 then
    return false;
  end if;
  perform private.validate_flash_question_document(private.question_version_document(target_question));
  return true;
exception when others then
  return false;
end;
$$;

create or replace function private.is_supported_competitive_question_extension(target_question uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_valid_published_competitive_question_format(target_question, 'true-false')
    or private.is_valid_published_competitive_question_format(target_question, 'ordering')
    or private.is_valid_published_competitive_question_format(target_question, 'classification')
    or private.is_valid_published_competitive_question_format(target_question, 'logic-matrix')
    or private.is_valid_published_competitive_question_format(target_question, 'zip')
    or private.is_valid_published_competitive_question_format(target_question, 'escape')
    or private.is_valid_published_competitive_question_format(target_question, 'word-hashtag')
    or private.is_valid_published_competitive_question_format(target_question, 'odd-one-out')
    or private.is_valid_published_competitive_question_format(target_question, 'connect-pairs')
$$;

alter function private.is_valid_published_competitive_question_format(uuid, text) owner to postgres;
alter function private.is_supported_competitive_question_extension(uuid) owner to postgres;
revoke all on function private.is_valid_published_competitive_question_format(uuid, text),
  private.is_supported_competitive_question_extension(uuid)
  from public, anon, authenticated, service_role;

comment on function private.is_valid_published_competitive_question_format(uuid, text) is
  'Validates a published version against its existing editorial contract before competitive admission.';
comment on function private.is_supported_competitive_question_extension(uuid) is
  'Additive allowlist for server-evaluated formats shared by Flash, Survival and Pyramid.';
