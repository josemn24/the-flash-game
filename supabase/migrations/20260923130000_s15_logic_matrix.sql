begin;

-- S15 format slice 4/4: add logic-matrix to the shared competitive allowlist.

create or replace function private.is_supported_competitive_question_extension(target_question uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_valid_published_competitive_question_format(target_question, 'true-false')
    or private.is_valid_published_competitive_question_format(target_question, 'ordering')
    or private.is_valid_published_competitive_question_format(target_question, 'classification')
    or private.is_valid_published_competitive_question_format(target_question, 'logic-matrix')
$$;

alter function private.is_valid_published_competitive_question_format(uuid, text) owner to postgres;
alter function private.is_supported_competitive_question_extension(uuid) owner to postgres;
revoke all on function private.is_valid_published_competitive_question_format(uuid, text),
  private.is_supported_competitive_question_extension(uuid)
  from public, anon, authenticated, service_role;

commit;
