-- word-hashtag: editorial validation. Published eligibility remains in the competitive extension.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_word_hashtag_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
  if jsonb_typeof(public_payload) is distinct from 'object'
    or jsonb_typeof(solution_payload) is distinct from 'object'
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
    or not private.word_hashtag_content_valid(public_payload, solution_payload) then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  return;
end;
$$;

alter function private.validate_word_hashtag_question_document(jsonb) owner to postgres;
revoke all on function private.validate_word_hashtag_question_document(jsonb)
  from public, anon, authenticated, service_role;
