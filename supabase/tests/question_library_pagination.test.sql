begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @question-library-fixtures
select test_support.as_actor('superadmin');
insert into test_support.library_results(label, result)
select 'page-' || n, public.get_superadmin_question_library(jsonb_build_object('search','library-fixture',
  'status','published','page',n,'pageSize',25)) from generate_series(1, 7) n;
select is(jsonb_array_length(result->'entries'), case when label in ('page-6','page-7') then 0 else 25 end,
  label || ' limits candidate rows before aggregation') from test_support.library_results where label like 'page-%' order by label;
select is((result->>'total')::integer, 125, label || ' keeps the complete total')
from test_support.library_results where label like 'page-%' order by label;
select is((select count(*) from test_support.library_results cross join lateral jsonb_array_elements(result->'entries') entry where label like 'page-%'),
  125::bigint, 'All pages cover every definition exactly once');
select is((select count(distinct entry->>'questionVersionId') from test_support.library_results
  cross join lateral jsonb_array_elements(result->'entries') entry where label like 'page-%'), 125::bigint,
  'Adjacent pages never repeat versions');
select is((select jsonb_agg(entry->>'questionVersionId' order by label, ordinal)
  from test_support.library_results cross join lateral jsonb_array_elements(result->'entries') with ordinality as v(entry, ordinal) where label like 'page-%'),
  (select jsonb_agg(id::text order by updated_at desc, id) from private.question_versions
   where (version_number = 1 and question_definition_id <> test_support.id('library-definition-1')
     or id = test_support.id('library-extra-2'))
     and question_definition_id in (select id from private.question_definitions where slug like 'library-fixture-%')),
  'Pages preserve updated_at descending and UUID ascending, including timestamp ties');
select is(jsonb_array_length(public.get_superadmin_question_library('{"search":"library-fixture","pageSize":100}')->'entries'),
  100, 'First page can contain 100 rows');
select is(jsonb_array_length(public.get_superadmin_question_library('{"search":"library-fixture","pageSize":100,"page":2}')->'entries'),
  25, 'Second large page contains the remaining rows');
select is(jsonb_array_length(public.get_superadmin_question_library('{"search":"library-fixture","status":"all","pageSize":100,"page":2}')->'entries'),
  28, 'All-status pagination retains every version');
select is(public.get_superadmin_question_library('{"search":"library-fixture","status":"all","page":10000}')->'entries',
  '[]'::jsonb, 'Deep empty pages return an array');
select is(public.get_superadmin_question_library('{"search":"library-fixture-001","status":"published","tag":"original","type":"true-false","pageSize":1}')->'entries'->0->>'questionVersionId',
  test_support.id('library-version-1')::text, 'Combined filters run before selecting the latest matching version and paging');
select * from finish();
rollback;
