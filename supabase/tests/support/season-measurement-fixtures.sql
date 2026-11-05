create function test_support.must_fail(statement text, expected_code text) returns void
language plpgsql as $$
begin
 begin
  execute statement;
 exception when others then
  if sqlstate=expected_code then return; end if;
  raise exception 'Expected %, got %: %',expected_code,sqlstate,sqlerrm;
 end;
 raise exception 'Expected failure %: %',expected_code,statement;
end $$;
grant execute on function test_support.must_fail(text,text) to authenticated,anon,service_role;

-- One authoritative completion, independent of analytics and study configuration.
select test_support.as_actor('member');
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash')));
do $$begin
 for n in 1..2 loop
  perform test_support.run('prepare_interaction');
  perform test_support.run('receive_answer','{"answer":true}');
  perform test_support.run('record_evaluation','{"status":"correct","points":50}');
 end loop;
end $$;
select test_support.run('complete_attempt');
