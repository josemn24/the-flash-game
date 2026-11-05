-- Loaded only in disposable databases, after command-fixtures.sql.
insert into private.question_definitions(id, slug, created_by_player_id)
select test_support.id('library-definition-' || n), 'library-fixture-' || lpad(n::text, 3, '0'),
  test_support.id('superadmin') from generate_series(1, 125) n;
insert into private.question_versions(id, question_definition_id, version_number, type,
  time_limit_ms, public_payload, created_by_player_id)
select test_support.id('library-version-' || n), test_support.id('library-definition-' || n), 1,
  'true-false', 30000, jsonb_build_object('question', 'Library original ' || n,
    'category', 'Library', 'tags', jsonb_build_object('topic', 'original', 'group', n % 3)),
  test_support.id('superadmin') from generate_series(1, 125) n;
insert into private.question_versions(id, question_definition_id, version_number, type,
  time_limit_ms, public_payload, created_by_player_id)
select test_support.id('library-extra-' || n), test_support.id('library-definition-1'), n,
  'true-false', 30000, jsonb_build_object('question', 'Library ' || case n
    when 2 then 'replacement' when 3 then 'archived' else 'draft' end,
    'category', 'Library', 'tags', jsonb_build_object('topic', case n
      when 2 then 'replacement' when 3 then 'archived' else 'draft' end)),
  test_support.id('superadmin') from generate_series(2, 4) n;
insert into private.question_version_solutions(question_version_id, solution_payload)
select version.id, '{"correctAnswer":true,"explanation":"Library solution"}'::jsonb
from private.question_versions version join private.question_definitions definition
  on definition.id = version.question_definition_id where definition.slug like 'library-fixture-%';
-- One statement deliberately gives every published row the same updated_at.
update private.question_versions version set status = 'published'
from private.question_definitions definition
where definition.id = version.question_definition_id and definition.slug like 'library-fixture-%'
  and version.version_number <> 4;
update private.question_versions set status = 'archived' where id = test_support.id('library-extra-3');

create table test_support.library_results(label text primary key, input jsonb, result jsonb);
create function test_support.library_document(slug_value text) returns jsonb language sql immutable as $$
  select jsonb_build_object('slug', slug_value, 'type', 'true-false', 'payloadSchemaVersion', 1,
    'timeLimitMs', 30000, 'publicPayload', jsonb_build_object('question', 'Library command?',
      'category', 'Library', 'tags', '{}'::jsonb),
    'solutionPayload', jsonb_build_object('correctAnswer', true, 'explanation', 'Library command'))
$$;
create function test_support.library_error(statement text) returns jsonb language plpgsql as $$
declare detail_value text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics detail_value = pg_exception_detail;
  return jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm, 'detail', detail_value);
end;
$$;
