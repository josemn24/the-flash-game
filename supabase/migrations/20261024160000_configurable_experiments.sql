-- Generic, independently scoped measurement; previous migrations remain immutable.
create function private.tabarnia_experiment_definition() returns jsonb language sql immutable set search_path='' as $$ select '{"schemaVersion":1,"templateId":"tabarnia-daily-v2","templateVersion":1,"name":"Tabarnia","cohort":{"size":14,"requireInvitations":true,"requireAccess":true,"excludePlatformAccounts":true},"publications":{"count":9,"windowHours":24,"contiguous":true},"recurrence":{"minimumCompleted":6,"tailCount":3,"minimumTailCompleted":2},"primaryMetric":"recurrence","thresholds":{"supported":8,"weakened":4,"unit":"count"},"windows":{"primaryDelayHours":24,"feedbackDelayHours":168,"earlyActivationHours":48,"ranking":"play"},"metrics":[{"id":"activation","version":1},{"id":"participation","version":1},{"id":"conversion","version":1},{"id":"completion","version":1},{"id":"continuity","version":1},{"id":"enjoyment","version":1},{"id":"ranking","version":1},{"id":"practice","version":1},{"id":"reliability","version":1},{"id":"operation","version":1}],"feedback":{"enabled":true,"label":"¿Cuánto has disfrutado este desafío?","minimum":1,"maximum":5},"retentionDays":90,"launchPolicy":"gate_season"}'::jsonb $$;
revoke all on function private.tabarnia_experiment_definition() from public,anon,authenticated,service_role;
alter table private.product_experiments add column definition jsonb not null default private.tabarnia_experiment_definition(), add column definition_hash text;
alter table private.product_experiments drop constraint product_experiments_season_id_key, drop constraint product_experiments_protocol_check;
alter table private.product_experiment_publications drop constraint product_experiment_publications_position_check, drop constraint product_experiment_publications_check;
alter table private.product_experiment_publications add column room_id uuid references public.rooms(id), add column season_id uuid references public.seasons(id);
update private.product_experiment_publications ep set season_id=sc.season_id,room_id=season.room_id from public.scheduled_challenges sc join public.seasons season on season.id=sc.season_id where sc.id=ep.publication_id;
alter table private.product_experiment_publications alter column room_id set not null, alter column season_id set not null;
alter table private.product_experiment_publications add constraint product_publication_position_positive check(position>0), add constraint product_publication_window_positive check(closes_at>opens_at);
alter table private.product_experiment_participants drop constraint product_experiment_participants_code_check;
alter table private.product_experiment_participants add constraint product_participant_code check(code ~ '^P[0-9]{2,6}$');
alter table private.product_events drop constraint product_events_pkey;
alter table private.product_events add primary key(experiment_id,event_id);
alter table private.product_ratings drop constraint product_ratings_pkey, drop constraint product_ratings_value_check;
alter table private.product_ratings add primary key(experiment_id,id), add constraint product_rating_value check(value between 1 and 100);
create index product_participant_player_idx on private.product_experiment_participants(player_id,experiment_id);
create index product_publication_lookup_idx on private.product_experiment_publications(publication_id,experiment_id);
create index product_events_participant_time_idx on private.product_events(experiment_id,participant_code,received_at);
create index product_experiment_room_state_idx on private.product_experiments(room_id,state,created_at);
update private.product_experiments set definition_hash=md5(definition::text) where state<>'draft';
create function private.validate_experiment_definition(d jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare size integer; count_value integer; metric jsonb; t jsonb;
begin
 if jsonb_typeof(d) is distinct from 'object' or d->>'schemaVersion' is distinct from '1' or d->>'templateId' !~ '^[a-z0-9][a-z0-9-]{0,79}$' or d->>'templateId' is null
 or nullif(btrim(d->>'name'),'') is null or length(d->>'name')>200 or (d->>'templateVersion')::integer not between 1 and 1000000 then raise exception 'invalid_definition'; end if;
 size:=(d->'cohort'->>'size')::integer; count_value:=(d->'publications'->>'count')::integer;
 if size is null or size not between 1 and 10000 or count_value is null or count_value not between 1 and 1000
 or jsonb_typeof(d->'cohort'->'requireInvitations') is distinct from 'boolean'
 or jsonb_typeof(d->'cohort'->'requireAccess') is distinct from 'boolean'
 or jsonb_typeof(d->'cohort'->'excludePlatformAccounts') is distinct from 'boolean'
 or jsonb_typeof(d->'publications'->'contiguous') is distinct from 'boolean'
 or not (d->'publications' ? 'windowHours')
 or (d->'publications'->>'windowHours' is not null and ((d->'publications'->>'windowHours')::numeric<=0 or (d->'publications'->>'windowHours')::numeric>87600))
 or (d->'recurrence'->>'minimumCompleted')::integer not between 1 and count_value
 or (d->'recurrence'->>'tailCount')::integer not between 1 and count_value
 or (d->'recurrence'->>'minimumTailCompleted')::integer not between 0 and least((d->'recurrence'->>'tailCount')::integer,(d->'recurrence'->>'minimumCompleted')::integer)
 or not (d ? 'primaryMetric') or coalesce(d->>'primaryMetric','none') not in ('none','recurrence','activation','completion_rate')
 or (d->'windows'->>'primaryDelayHours')::integer not between 0 and 87600
 or (d->'windows'->>'feedbackDelayHours')::integer not between (d->'windows'->>'primaryDelayHours')::integer and 87600
 or (d->'windows'->>'earlyActivationHours')::integer not between 0 and 87600
 or d->'windows'->>'ranking' not in ('play','primary')
 or jsonb_typeof(d->'feedback'->'enabled') is distinct from 'boolean'
 or nullif(btrim(d->'feedback'->>'label'),'') is null or length(d->'feedback'->>'label')>500
 or (d->'feedback'->>'minimum')::integer not between 1 and 100
 or (d->'feedback'->>'maximum')::integer not between (d->'feedback'->>'minimum')::integer and least(100,(d->'feedback'->>'minimum')::integer+10)
 or (d->>'retentionDays')::integer not between 1 and 3650 or d->>'launchPolicy' not in ('observe','gate_season')
 or jsonb_typeof(d->'metrics') is distinct from 'array' then raise exception 'invalid_definition'; end if;
 -- Required scalar leaves must be present; SQL NULL must never bypass validation.
 if exists(select 1 from (values
 (d->'recurrence'->>'minimumCompleted'),(d->'recurrence'->>'tailCount'),(d->'recurrence'->>'minimumTailCompleted'),
 (d->'windows'->>'primaryDelayHours'),(d->'windows'->>'feedbackDelayHours'),(d->'windows'->>'earlyActivationHours'),(d->'windows'->>'ranking'),
 (d->'feedback'->>'minimum'),(d->'feedback'->>'maximum'),(d->>'retentionDays'),(d->>'launchPolicy'),(d->>'templateVersion')) required(value) where value is null) then raise exception 'invalid_definition'; end if;
 if jsonb_array_length(d->'metrics')>10 or (select count(distinct x->>'id') from jsonb_array_elements(d->'metrics') x)<>jsonb_array_length(d->'metrics') then raise exception 'invalid_definition'; end if;
 for metric in select value from jsonb_array_elements(d->'metrics') loop
  if metric->>'id' is null or metric->>'id' not in ('activation','participation','conversion','completion','continuity','enjoyment','ranking','practice','reliability','operation') or metric->>'version' is distinct from '1' then raise exception 'invalid_definition'; end if;
 end loop;
 t:=d->'thresholds';
 if t is null then raise exception 'invalid_definition'; end if;
 if t<>'null'::jsonb and (d->>'primaryMetric' is null or t->>'unit' is null or t->>'unit' not in ('count','ratio') or t->>'supported' is null or t->>'weakened' is null
 or (t->>'weakened')::numeric<0 or (t->>'supported')::numeric<=(t->>'weakened')::numeric
 or (t->>'supported')::numeric>case when t->>'unit'='ratio' then 1 when d->>'primaryMetric'='completion_rate' then size*count_value else size end) then raise exception 'invalid_definition'; end if;
exception when others then raise exception 'invalid_definition' using errcode='22023';
end $$;
revoke all on function private.validate_experiment_definition(jsonb) from public,anon,authenticated,service_role;
create function private.guard_experiment_definition() returns trigger
language plpgsql set search_path='' as $$
begin
 perform private.validate_experiment_definition(new.definition);
 if tg_op='UPDATE' and old.state<>'draft' and new.definition is distinct from old.definition then raise exception 'definition_frozen' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function private.guard_experiment_definition() from public,anon,authenticated,service_role;
create trigger guard_experiment_definition before insert or update of definition on private.product_experiments for each row execute function private.guard_experiment_definition();
create or replace function public.manage_product_experiment(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.require_measurement_admin(); op text:=input->>'op'; k text:=input->>'idempotencyKey';
 e private.product_experiments%rowtype; p private.product_experiment_participants%rowtype; j private.product_experiment_journal%rowtype;
 cached private.product_measurement_commands%rowtype; item jsonb; idx integer; result jsonb; before_value jsonb;
 total integer; finish timestamptz; sid uuid; next_revision integer; instant timestamptz:=clock_timestamp(); d jsonb; cohort_size integer; publication_count integer;
begin
 if jsonb_typeof(input)<>'object' or k is null or length(k) not between 8 and 160 then raise exception 'invalid_command' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('measurement:'||actor||':'||k,0));
 if op='create' then
   select ex.* into e from private.product_experiments ex join private.product_measurement_commands cmd on cmd.experiment_id=ex.id where cmd.key=k and cmd.actor_id=actor and cmd.input->'command'->>'op'='create';
   if not found then
     if not exists(select 1 from public.seasons where id=(input->>'seasonId')::uuid and room_id=(input->>'roomId')::uuid and (coalesce(input->'definition'->>'launchPolicy','gate_season')='observe' or status='draft')) then raise exception 'invalid_season' using errcode='22023'; end if;
     d:=coalesce(input->'definition',private.tabarnia_experiment_definition());
     perform private.validate_experiment_definition(d);
     insert into private.product_experiments(room_id,season_id,channel,protocol,definition) values((input->>'roomId')::uuid,(input->>'seasonId')::uuid,left(coalesce(input->>'channel',''),500),d->>'templateId',d) returning * into e;
     for idx in 1..(d->'cohort'->>'size')::integer loop
       insert into private.product_experiment_participants(experiment_id,code,private_reference) values(e.id,'P'||case when idx<10 then '0'||idx::text else idx::text end,'');
     end loop;
   end if;
 else
   select * into e from private.product_experiments where id=(input->>'experimentId')::uuid for update;
   if not found or e.purged_at is not null then raise exception 'experiment_unavailable' using errcode='P0002'; end if;
 end if;
 select * into cached from private.product_measurement_commands where experiment_id=e.id and key=k;
 if found then
   if ((cached.input->'command')-'report'-'sources')<>(input-'report'-'sources') or cached.actor_id<>actor then raise exception 'idempotency_conflict' using errcode='40001'; end if;
   return cached.result;
 end if;
 if op<>'create' and (input->>'revision')::integer is distinct from e.revision then raise exception 'stale_version' using errcode='40001'; end if;
 d:=e.definition; cohort_size:=(d->'cohort'->>'size')::integer; publication_count:=(d->'publications'->>'count')::integer;
 before_value:=to_jsonb(e)-'channel';
 if op in ('define','configure') then
   if e.state<>'draft' then raise exception 'invalid_design' using errcode='22023'; end if;
   d:=coalesce(input->'definition',e.definition); perform private.validate_experiment_definition(d);
   cohort_size:=(d->'cohort'->>'size')::integer; publication_count:=(d->'publications'->>'count')::integer;
   if op='configure' and jsonb_array_length(input->'publicationIds')<>publication_count then raise exception 'invalid_design' using errcode='22023'; end if;
   if exists(select 1 from private.product_experiment_participants member where member.experiment_id=e.id and substring(member.code from 2)::integer>cohort_size and (member.player_id is not null or nullif(member.private_reference,'') is not null)) then raise exception 'invalid_cohort_resize'; end if;
   delete from private.product_experiment_participants member where member.experiment_id=e.id and substring(member.code from 2)::integer>cohort_size;
   for idx in 1..cohort_size loop
     insert into private.product_experiment_participants(experiment_id,code,private_reference) values(e.id,'P'||case when idx<10 then '0'||idx::text else idx::text end,'') on conflict do nothing;
   end loop;
   update private.product_experiments set definition=d,protocol=d->>'templateId' where id=e.id;
   if op='define' then
     if (d->'publications') is distinct from (e.definition->'publications') then delete from private.product_experiment_publications where experiment_id=e.id; end if;
   else
   delete from private.product_experiment_publications where experiment_id=e.id;
   idx:=0;
   for item in select value from jsonb_array_elements(input->'publicationIds') loop
     idx:=idx+1;
     insert into private.product_experiment_publications(experiment_id,publication_id,position,challenge_version_id,opens_at,closes_at,mode,room_id,season_id)
       select e.id,s.id,idx,s.challenge_version_id,s.opens_at,s.closes_at,v.mode,scope.room_id,s.season_id from public.scheduled_challenges s join public.seasons scope on scope.id=s.season_id join private.challenge_versions v on v.id=s.challenge_version_id
       where s.id=(item#>>'{}')::uuid and s.status<>'cancelled';
     if not found then raise exception 'invalid_publication' using errcode='22023'; end if;
   end loop;
   if d->'publications'->>'windowHours' is not null and exists(select 1 from private.product_experiment_publications pub where pub.experiment_id=e.id and pub.closes_at-pub.opens_at<>make_interval(secs=>(d->'publications'->>'windowHours')::numeric*3600)) then raise exception 'invalid_design'; end if;
   end if;
   update private.product_experiments set channel=left(coalesce(input->>'channel',''),500) where id=e.id;
 elsif op='participant' then
   select * into p from private.product_experiment_participants where experiment_id=e.id and code=input->>'code' for update;
   if not found then raise exception 'invalid_participant' using errcode='22023'; end if;
   if e.state<>'draft' and (p.private_reference is distinct from input->>'privateReference' or (p.player_id is not null and p.player_id is distinct from nullif(input->>'playerId','')::uuid) or (p.invited_at is not null and p.invited_at is distinct from nullif(input->>'invitedAt','')::timestamptz)) then
     insert into private.product_experiment_journal(experiment_id,kind,source,topic,note,participant_codes,occurred_at) values(e.id,'deviation','admin','cohort','Corrección de identidad posterior a la congelación.',array[p.code],instant);
   end if;
   if nullif(input->>'invitedAt','')::timestamptz<e.frozen_at and p.invited_at is distinct from nullif(input->>'invitedAt','')::timestamptz then
     insert into private.product_experiment_journal(experiment_id,kind,source,topic,note,participant_codes,occurred_at) values(e.id,'deviation','admin','cohort','Invitación declarada anterior a congelar el protocolo.',array[p.code],instant);
   end if;
   if (d->'cohort'->>'excludePlatformAccounts')::boolean and nullif(input->>'playerId','') is not null and exists(select 1 from private.platform_role_assignments where player_id=(input->>'playerId')::uuid and role='superadmin') then raise exception 'operational_account_excluded' using errcode='22023'; end if;
   if nullif(input->>'invitedAt','')::timestamptz>instant or nullif(input->>'accessAt','')::timestamptz>instant then raise exception 'invalid_date' using errcode='22023'; end if;
   if e.state='draft' and nullif(input->>'invitedAt','') is not null then raise exception 'freeze_before_inviting' using errcode='22023'; end if;
   update private.product_experiment_participants set private_reference=nullif(input->>'privateReference',''),player_id=nullif(input->>'playerId','')::uuid,
     invited_at=nullif(input->>'invitedAt','')::timestamptz,response=coalesce(input->>'response','pending'),access_at=nullif(input->>'accessAt','')::timestamptz where experiment_id=e.id and code=p.code;
   if e.state='frozen' and nullif(input->>'invitedAt','') is not null then update private.product_experiments set state='running' where id=e.id; end if;
   before_value:=to_jsonb(p);
 elsif op='freeze' then
   if e.state<>'draft' then raise exception 'invalid_design' using errcode='22023'; end if;
   select count(*) into total from private.product_experiment_publications where experiment_id=e.id;
   if total<>publication_count or ((d->'publications'->>'contiguous')::boolean and exists(select 1 from private.product_experiment_publications a join private.product_experiment_publications b on b.experiment_id=a.experiment_id and b.position=a.position+1 where a.experiment_id=e.id and a.closes_at<>b.opens_at))
     or exists(select 1 from private.product_experiment_participants where experiment_id=e.id and nullif(btrim(private_reference),'') is null)
     or (select count(distinct lower(btrim(private_reference))) from private.product_experiment_participants where experiment_id=e.id)<>cohort_size
     or (d->>'launchPolicy'='gate_season' and (select min(opens_at) from private.product_experiment_publications where experiment_id=e.id)<=instant) then raise exception 'invalid_design' using errcode='22023'; end if;
   update private.product_experiments set state='frozen',frozen_at=instant,definition_hash=md5(definition::text) where id=e.id;
 elsif op='start' then
   if e.state<>'frozen' then raise exception 'invalid_state'; end if;
   update private.product_experiments set state='running' where id=e.id;
 elsif op='journal' then
   if input->>'kind'='cost' and (nullif(input->>'amount','') is null or nullif(btrim(input->>'allocation'),'') is null) then raise exception 'invalid_cost' using errcode='22023'; end if;
   -- Corrections after closing create a new audited revision; stored snapshots stay unchanged.
   if exists(select 1 from jsonb_array_elements_text(coalesce(input->'participantCodes','[]'::jsonb)) c where not exists(select 1 from private.product_experiment_participants cohort_member where cohort_member.experiment_id=e.id and cohort_member.code=c.value))
     or exists(select 1 from jsonb_array_elements_text(coalesce(input->'publicationIds','[]'::jsonb)) c where not exists(select 1 from private.product_experiment_publications frozen_publication where frozen_publication.experiment_id=e.id and frozen_publication.publication_id=c.value::uuid)) then raise exception 'invalid_context' using errcode='22023'; end if;
   sid:=coalesce(nullif(input->>'entryId','')::uuid,gen_random_uuid());
   select * into j from private.product_experiment_journal where id=sid and experiment_id=e.id;
   before_value:=case when found then to_jsonb(j) else null end;
   if exists(select 1 from private.product_experiment_journal where id=sid and experiment_id<>e.id) then raise exception 'invalid_context' using errcode='22023'; end if;
   if coalesce((input->>'nonEvaluable')::boolean,false) and input->>'kind'<>'incident' then raise exception 'invalid_incident' using errcode='22023'; end if;
   insert into private.product_experiment_journal(id,experiment_id,kind,source,topic,note,participant_codes,publication_ids,occurred_at,minutes,amount,allocation,resolved_at,non_evaluable)
   values(sid,e.id,input->>'kind',left(coalesce(input->>'source',''),80),left(coalesce(input->>'topic',''),80),input->>'note',
     array(select jsonb_array_elements_text(coalesce(input->'participantCodes','[]'::jsonb))),array(select value::uuid from jsonb_array_elements_text(coalesce(input->'publicationIds','[]'::jsonb))),
     (input->>'occurredAt')::timestamptz,nullif(input->>'minutes','')::numeric,nullif(input->>'amount','')::numeric,nullif(input->>'allocation',''),nullif(input->>'resolvedAt','')::timestamptz,coalesce((input->>'nonEvaluable')::boolean,false))
   on conflict(id) do update set kind=excluded.kind,source=excluded.source,topic=excluded.topic,note=excluded.note,participant_codes=excluded.participant_codes,publication_ids=excluded.publication_ids,occurred_at=excluded.occurred_at,minutes=excluded.minutes,amount=excluded.amount,allocation=excluded.allocation,resolved_at=excluded.resolved_at,non_evaluable=excluded.non_evaluable,revision=private.product_experiment_journal.revision+1,recorded_at=instant;
 elsif op='snapshot' then
   select max(closes_at) into finish from private.product_experiment_publications where experiment_id=e.id;
   if e.state not in ('running','closed') or finish is null or instant<finish+make_interval(secs=>(d->'windows'->>'primaryDelayHours')::integer*3600) or (input->>'kind'='final' and instant<finish+make_interval(secs=>(d->'windows'->>'feedbackDelayHours')::integer*3600)) then raise exception 'cutoff_not_reached' using errcode='22023'; end if;
   if jsonb_typeof(input->'report') is distinct from 'object' or input->'report'->>'protocol' is distinct from e.protocol or input->'report'->'definition' is distinct from d or input->'report'->>'experimentId' is distinct from e.id::text or input->'sources'->'experiment'->>'id' is distinct from e.id::text or jsonb_array_length(input->'report'->'cells') is distinct from cohort_size*publication_count or (input->'report'->>'cutoff')::timestamptz<>finish+make_interval(secs=>(d->'windows'->>'primaryDelayHours')::integer*3600) then raise exception 'invalid_snapshot' using errcode='22023'; end if;
   select coalesce(max(revision),0)+1 into next_revision from private.product_measurement_snapshots where experiment_id=e.id;
   insert into private.product_measurement_snapshots(experiment_id,kind,revision,cutoff,report,sources)
     values(e.id,input->>'kind',next_revision,finish+make_interval(secs=>(d->'windows'->>'primaryDelayHours')::integer*3600),input->'report',input->'sources') returning id into sid;
   if input->>'kind'='final' and e.closed_at is null then update private.product_experiments set state='closed',closed_at=instant,purge_at=instant+make_interval(days=>(d->>'retentionDays')::integer) where id=e.id; end if;
 elsif op<>'create' then raise exception 'invalid_operation' using errcode='22023';
 end if;
 update private.product_experiments set revision=revision+1 where id=e.id returning * into e;
 result:=jsonb_build_object('experimentId',e.id,'revision',e.revision,'snapshotId',case when op='snapshot' then sid else null end);
 -- Full before/after records live in retention-scoped command revisions, not global audit.
 insert into private.product_measurement_commands(experiment_id,key,actor_id,input,result) values(e.id,k,actor,jsonb_build_object('command',input,'before',before_value),result);
 -- Compare idempotency against the command envelope on retries below.
 return result;
end $$;
create or replace function public.get_superadmin_product_experiment(target_experiment_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e private.product_experiments%rowtype;
begin
 perform private.require_measurement_admin();
 select * into e from private.product_experiments where id=target_experiment_id;
 if not found then return null; end if;
 return jsonb_build_object('experiment',to_jsonb(e)||jsonb_build_object('design_changed',exists(select 1 from private.product_experiment_publications frozen join public.scheduled_challenges actual on actual.id=frozen.publication_id where frozen.experiment_id=e.id and (actual.opens_at<>frozen.opens_at or actual.closes_at<>frozen.closes_at or actual.challenge_version_id<>frozen.challenge_version_id or actual.season_id<>frozen.season_id or actual.status='cancelled'))),'now',clock_timestamp(),
 'publications',coalesce((select jsonb_agg(to_jsonb(p)-'experiment_id' order by position) from private.product_experiment_publications p where experiment_id=e.id),'[]'::jsonb),
 'participants',coalesce((select jsonb_agg(to_jsonb(p)-'experiment_id' order by code) from private.product_experiment_participants p where experiment_id=e.id),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(x)-'experiment_id' order by received_at,event_id) from private.product_events x where experiment_id=e.id),'[]'::jsonb),
 'ratings',coalesce((select jsonb_agg(to_jsonb(x)-'experiment_id' order by received_at,id) from private.product_ratings x where experiment_id=e.id),'[]'::jsonb),
 'journal',coalesce((select jsonb_agg(to_jsonb(x)-'experiment_id' order by occurred_at,id) from private.product_experiment_journal x where experiment_id=e.id),'[]'::jsonb),
 'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'player_id',a.player_id,'scheduled_challenge_id',a.scheduled_challenge_id,'kind',a.kind,'status',a.status,'started_at',a.started_at,'completed_at',a.completed_at,'score',a.score,'terminal_reason',a.terminal_reason,
   'actions',coalesce((select jsonb_agg(jsonb_build_object('type',al.action,'created_at',al.created_at)) from private.audit_log al where al.entity_type='attempt' and al.entity_id=a.id and al.action in ('submit_queens_placement','save_queens_draft','submit_queens_answer','submit_word_search_selection','reveal_progressive_clue','submit_word_hashtag_swap','submit_mini_wordle_guess','submit_logic_code_attempt','recover','takeover_confirmed')),'[]'::jsonb),
   'answers',coalesce((select jsonb_agg(jsonb_build_object('status',aa.status,'time_used_ms',aa.time_used_ms,'presented_at',aa.presented_at,'created_at',aa.created_at,'has_input',aa.answer is not null and aa.answer<>'null'::jsonb)) from private.attempt_answers aa where aa.attempt_id=a.id),'[]'::jsonb)))
   from public.attempts a join private.product_experiment_participants p on p.player_id=a.player_id and p.experiment_id=e.id
   join private.product_experiment_publications pub on pub.publication_id=a.scheduled_challenge_id and pub.experiment_id=e.id where a.kind='competitive'),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(jsonb_build_object('entity_id',al.entity_id,'action',al.action,'created_at',al.created_at,'before_status',al.before_payload->>'status','after_status',al.after_payload->>'status'))
   from private.audit_log al join public.attempts a on a.id=al.entity_id
   join private.product_experiment_participants p on p.player_id=a.player_id and p.experiment_id=e.id
   join private.product_experiment_publications pub on pub.publication_id=a.scheduled_challenge_id and pub.experiment_id=e.id
   where al.entity_type='attempt' and al.action in ('invalidate','expire_stale_attempt','close_attempt_abandon','close_attempt_permission_revoked','complete','abandon')),'[]'::jsonb),
 'snapshots',coalesce((select jsonb_agg((to_jsonb(s)-'experiment_id'-'sources')||jsonb_build_object('sources',null) order by revision desc) from private.product_measurement_snapshots s where experiment_id=e.id),'[]'::jsonb));
end $$;

create or replace function public.record_product_event(input jsonb) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.current_player_id(); e private.product_experiments%rowtype; code_value text; instant timestamptz:=clock_timestamp(); pid uuid:=nullif(input->>'publicationId','')::uuid; previous private.product_events%rowtype; recorded boolean:=false; limited boolean:=false;
begin
 if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if jsonb_typeof(input)<>'object' or exists(select 1 from jsonb_object_keys(input) k where not k=any(array['eventId','type','roomId','publicationId','visitId','occurredAt','appVersion'])) or input->>'type' not in ('room_viewed','challenge_intro_viewed','ranking_viewed','review_viewed','rehearsal_started','rehearsal_completed') then raise exception 'invalid_event' using errcode='22023'; end if;
 if pid is null and input->>'type' not in ('room_viewed','ranking_viewed') then raise exception 'invalid_context' using errcode='22023'; end if;
 -- A browser observation belongs to every eligible experiment, never whichever was created last.
 for e in select ex.* from private.product_experiments ex
 join private.product_experiment_participants member on member.experiment_id=ex.id and member.player_id=actor
 where ex.state='running' and ex.purged_at is null
 and (not (ex.definition->'cohort'->>'requireInvitations')::boolean or member.invited_at<=instant)
 and (not (ex.definition->'cohort'->>'excludePlatformAccounts')::boolean or not exists(select 1 from private.platform_role_assignments where player_id=actor))
 and exists(select 1 from public.rooms r join public.room_memberships membership on membership.room_id=r.id and membership.player_id=actor
 where r.slug=input->>'roomId' and r.status='active' and membership.status='active' and membership.role<>'spectator'
 and (r.id=ex.room_id or exists(select 1 from private.product_experiment_publications ep join public.scheduled_challenges sc on sc.id=ep.publication_id where ep.experiment_id=ex.id and ep.room_id=r.id))
 and (pid is null or exists(select 1 from private.product_experiment_publications ep join public.scheduled_challenges sc on sc.id=ep.publication_id where ep.experiment_id=ex.id and ep.publication_id=pid and ep.room_id=r.id)))
 and instant<=(select max(closes_at)+make_interval(secs=>(ex.definition->'windows'->>'primaryDelayHours')::integer*3600) from private.product_experiment_publications where experiment_id=ex.id)
 order by ex.id loop
  select member.code into code_value from private.product_experiment_participants member where member.experiment_id=e.id and member.player_id=actor;
  perform pg_advisory_xact_lock(hashtextextended('product-event:'||e.id||':'||code_value,0));
  select * into previous from private.product_events where experiment_id=e.id and event_id=(input->>'eventId')::uuid;
  if found then
   if previous.participant_code<>code_value or previous.type<>input->>'type' or previous.visit_id<>(input->>'visitId')::uuid or previous.publication_id is distinct from pid then raise exception 'idempotency_conflict' using errcode='40001'; end if;
   recorded:=true; continue;
  end if;
  -- A saturated experiment must not consume the quota of another experiment.
  if (select count(*) from private.product_events where experiment_id=e.id and participant_code=code_value and received_at>instant-interval '1 minute')>=60 then limited:=true; continue; end if;
  insert into private.product_events(event_id,experiment_id,participant_code,publication_id,type,visit_id,occurred_at,app_version)
  values((input->>'eventId')::uuid,e.id,code_value,pid,input->>'type',(input->>'visitId')::uuid,(input->>'occurredAt')::timestamptz,input->>'appVersion') on conflict do nothing;
  recorded:=true;
 end loop;
 if limited and not recorded then raise exception 'measurement_rate_limited' using errcode='P0001'; end if;
 return recorded;
end $$;

-- Feedback instruments are explicitly selected when a publication belongs to several experiments.
create function public.get_my_product_instruments(target_publication_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_player_id();
begin
 if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('experimentId',e.id,'label',e.definition->'feedback'->>'label','minimum',(e.definition->'feedback'->>'minimum')::integer,'maximum',(e.definition->'feedback'->>'maximum')::integer,'value',(select value from private.product_ratings rating where rating.experiment_id=e.id and rating.participant_code=member.code and rating.publication_id=pub.publication_id order by rating.received_at desc,rating.id desc limit 1),'eligible',statement_timestamp()<=cut.finish,'closesAt',cut.finish) order by e.id)
 from private.product_experiments e join private.product_experiment_publications pub on pub.experiment_id=e.id
 join public.scheduled_challenges sc on sc.id=pub.publication_id
 join public.rooms room on room.id=pub.room_id and room.status='active'
 join private.product_experiment_participants member on member.experiment_id=e.id and member.player_id=actor
 join public.room_memberships membership on membership.room_id=pub.room_id and membership.player_id=actor and membership.status='active' and membership.role<>'spectator'
 cross join lateral (select max(closes_at)+make_interval(secs=>(e.definition->'windows'->>'feedbackDelayHours')::integer*3600) finish from private.product_experiment_publications where experiment_id=e.id) cut
 where pub.publication_id=target_publication_id and e.state in ('running','closed') and e.purged_at is null and (e.definition->'feedback'->>'enabled')::boolean
 and (not (e.definition->'cohort'->>'excludePlatformAccounts')::boolean or not exists(select 1 from private.platform_role_assignments where player_id=actor))
 and exists(select 1 from public.attempts attempt where attempt.player_id=actor and attempt.scheduled_challenge_id=pub.publication_id and attempt.kind='competitive' and attempt.status='completed' and attempt.started_at>=pub.opens_at and attempt.started_at<pub.closes_at)), '[]'::jsonb);
end $$;
revoke all on function public.get_my_product_instruments(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_my_product_instruments(uuid) to authenticated;
create or replace function public.read_my_product_rating(publication_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare instruments jsonb;
begin
 instruments:=public.get_my_product_instruments(publication_id);
 -- Preserve the old endpoint only when the selection is unambiguous.
 if jsonb_array_length(instruments)=1 then return instruments->0; end if;
 return jsonb_build_object('eligible',false,'value',null);
end $$;
create or replace function public.save_my_product_rating(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.current_player_id(); eligibility jsonb; ex_id uuid; code_value text; previous private.product_ratings%rowtype; instruments jsonb;
begin
 if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(input) k where not k=any(array['id','publicationId','value','experimentId'])) or jsonb_typeof(input->'value') is distinct from 'number' or (input->>'value')::numeric<>trunc((input->>'value')::numeric) then raise exception 'invalid_rating' using errcode='22023'; end if;
 instruments:=public.get_my_product_instruments((input->>'publicationId')::uuid);
 if input->>'experimentId' is null then
  if jsonb_array_length(instruments)<>1 then raise exception 'invalid_instrument' using errcode='22023'; end if;
  eligibility:=instruments->0;
 else
  select value into eligibility from jsonb_array_elements(instruments) where value->>'experimentId'=input->>'experimentId';
 end if;
 if eligibility is null then raise exception 'not_authorized' using errcode='42501'; end if;
 ex_id:=(eligibility->>'experimentId')::uuid;
 if (input->>'value')::integer not between (eligibility->>'minimum')::integer and (eligibility->>'maximum')::integer then raise exception 'invalid_rating' using errcode='22023'; end if;
 perform 1 from public.attempts where player_id=actor and scheduled_challenge_id=(input->>'publicationId')::uuid and kind='competitive' and status='completed' for share;
 if not found then raise exception 'not_authorized' using errcode='42501'; end if;
 select member.code into code_value from private.product_experiment_participants member where member.experiment_id=ex_id and member.player_id=actor;
 perform pg_advisory_xact_lock(hashtextextended('rating:'||ex_id||':'||code_value||':'||(input->>'publicationId'),0));
 select * into previous from private.product_ratings where experiment_id=ex_id and id=(input->>'id')::uuid;
 if found then
  if previous.participant_code<>code_value or previous.publication_id<>(input->>'publicationId')::uuid or previous.value<>(input->>'value')::integer then raise exception 'idempotency_conflict' using errcode='40001'; end if;
 else
  if clock_timestamp()>(eligibility->>'closesAt')::timestamptz then raise exception 'not_authorized' using errcode='42501'; end if;
  if (select count(*) from private.product_ratings where experiment_id=ex_id and participant_code=code_value and received_at>clock_timestamp()-interval '1 minute')>=60 then raise exception 'measurement_rate_limited'; end if;
  insert into private.product_ratings(id,experiment_id,participant_code,publication_id,value) values((input->>'id')::uuid,ex_id,code_value,(input->>'publicationId')::uuid,(input->>'value')::integer);
 end if;
 return eligibility||jsonb_build_object('value',(select value from private.product_ratings where experiment_id=ex_id and participant_code=code_value and publication_id=(input->>'publicationId')::uuid order by received_at desc,id desc limit 1));
end $$;

create or replace function private.guard_product_experiment_launch() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare e private.product_experiments%rowtype; t0 timestamptz;
begin
 if new.status<>'active' or old.status='active' then return new; end if;
 for e in select * from private.product_experiments where season_id=new.id and purged_at is null and definition->>'launchPolicy'='gate_season' order by id for update loop
  select min(opens_at) into t0 from private.product_experiment_publications where experiment_id=e.id;
  if t0 is null or clock_timestamp()>t0 or e.state<>'running' or
   (select count(*) from private.product_experiment_participants member join public.room_memberships membership on membership.player_id=member.player_id and membership.room_id=e.room_id and membership.status='active' and membership.role<>'spectator'
    where member.experiment_id=e.id and (not (e.definition->'cohort'->>'requireInvitations')::boolean or (member.invited_at is not null and member.invited_at<=clock_timestamp() and member.invited_at<t0))
    and (not (e.definition->'cohort'->>'requireAccess')::boolean or (member.access_at is not null and member.access_at<=clock_timestamp() and member.access_at<=t0)))<>(e.definition->'cohort'->>'size')::integer
  then raise exception 'experiment_not_ready' using errcode='55000'; end if;
 end loop;
 return new;
end $$;

create function public.get_superadmin_product_records(target_experiment_id uuid, dataset text, observed_before timestamptz, after_at timestamptz default null, after_id uuid default null, page_size integer default 500) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_measurement_admin();
 if page_size not between 1 and 1000 or (after_at is null)<>(after_id is null) then raise exception 'invalid_page' using errcode='22023'; end if;
 if dataset='events' then
  select coalesce(jsonb_agg(to_jsonb(row)-'experiment_id' order by row.received_at,row.event_id),'[]'::jsonb) into result from (select * from private.product_events where experiment_id=target_experiment_id and received_at<=observed_before and (after_at is null or (received_at,event_id)>(after_at,after_id)) order by received_at,event_id limit page_size) row;
 elsif dataset='ratings' then
  select coalesce(jsonb_agg(to_jsonb(row)-'experiment_id' order by row.received_at,row.id),'[]'::jsonb) into result from (select * from private.product_ratings where experiment_id=target_experiment_id and received_at<=observed_before and (after_at is null or (received_at,id)>(after_at,after_id)) order by received_at,id limit page_size) row;
 elsif dataset='journal' then
  select coalesce(jsonb_agg(to_jsonb(row)-'experiment_id' order by row.recorded_at,row.id),'[]'::jsonb) into result from (select * from private.product_experiment_journal where experiment_id=target_experiment_id and recorded_at<=observed_before and (after_at is null or (recorded_at,id)>(after_at,after_id)) order by recorded_at,id limit page_size) row;
 else raise exception 'invalid_dataset' using errcode='22023'; end if;
 return result;
end $$;
revoke all on function public.get_superadmin_product_records(uuid,text,timestamptz,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_superadmin_product_records(uuid,text,timestamptz,timestamptz,uuid,integer) to authenticated;
create index product_journal_recorded_idx on private.product_experiment_journal(experiment_id,recorded_at,id);
create function public.get_superadmin_product_snapshot(target_experiment_id uuid, target_snapshot_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_measurement_admin();
 return (select to_jsonb(snapshot)-'experiment_id' from private.product_measurement_snapshots snapshot where experiment_id=target_experiment_id and id=target_snapshot_id);
end $$;
revoke all on function public.get_superadmin_product_snapshot(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_superadmin_product_snapshot(uuid,uuid) to authenticated;

create or replace function public.get_superadmin_product_experiment_header(target_experiment_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e private.product_experiments%rowtype;
begin
 perform private.require_measurement_admin();
 select * into e from private.product_experiments where id=target_experiment_id;
 if not found then return null; end if;
 return jsonb_build_object('experiment',to_jsonb(e)||jsonb_build_object('design_changed',exists(select 1 from private.product_experiment_publications frozen join public.scheduled_challenges actual on actual.id=frozen.publication_id where frozen.experiment_id=e.id and (actual.opens_at<>frozen.opens_at or actual.closes_at<>frozen.closes_at or actual.challenge_version_id<>frozen.challenge_version_id or actual.season_id<>frozen.season_id or actual.status='cancelled'))),'now',clock_timestamp(),
 'publications',coalesce((select jsonb_agg(to_jsonb(p)-'experiment_id' order by position) from private.product_experiment_publications p where experiment_id=e.id),'[]'::jsonb),
 'participants',coalesce((select jsonb_agg(to_jsonb(p)-'experiment_id' order by code) from private.product_experiment_participants p where experiment_id=e.id),'[]'::jsonb),
 'events','[]'::jsonb,
 'ratings','[]'::jsonb,
 'journal','[]'::jsonb,
 'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'player_id',a.player_id,'scheduled_challenge_id',a.scheduled_challenge_id,'kind',a.kind,'status',a.status,'started_at',a.started_at,'completed_at',a.completed_at,'score',a.score,'terminal_reason',a.terminal_reason,
   'actions',coalesce((select jsonb_agg(jsonb_build_object('type',al.action,'created_at',al.created_at)) from private.audit_log al where al.entity_type='attempt' and al.entity_id=a.id and al.action in ('submit_queens_placement','save_queens_draft','submit_queens_answer','submit_word_search_selection','reveal_progressive_clue','submit_word_hashtag_swap','submit_mini_wordle_guess','submit_logic_code_attempt','recover','takeover_confirmed')),'[]'::jsonb),
   'answers',coalesce((select jsonb_agg(jsonb_build_object('status',aa.status,'time_used_ms',aa.time_used_ms,'presented_at',aa.presented_at,'created_at',aa.created_at,'has_input',aa.answer is not null and aa.answer<>'null'::jsonb)) from private.attempt_answers aa where aa.attempt_id=a.id),'[]'::jsonb)))
   from public.attempts a join private.product_experiment_participants p on p.player_id=a.player_id and p.experiment_id=e.id
   join private.product_experiment_publications pub on pub.publication_id=a.scheduled_challenge_id and pub.experiment_id=e.id where a.kind='competitive'),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(jsonb_build_object('entity_id',al.entity_id,'action',al.action,'created_at',al.created_at,'before_status',al.before_payload->>'status','after_status',al.after_payload->>'status'))
   from private.audit_log al join public.attempts a on a.id=al.entity_id
   join private.product_experiment_participants p on p.player_id=a.player_id and p.experiment_id=e.id
   join private.product_experiment_publications pub on pub.publication_id=a.scheduled_challenge_id and pub.experiment_id=e.id
   where al.entity_type='attempt' and al.action in ('invalidate','expire_stale_attempt','close_attempt_abandon','close_attempt_permission_revoked','complete','abandon')),'[]'::jsonb),
 'snapshots',coalesce((select jsonb_agg((to_jsonb(s)-'experiment_id'-'sources')||jsonb_build_object('sources',null) order by revision desc) from private.product_measurement_snapshots s where experiment_id=e.id),'[]'::jsonb));
end $$;


revoke all on function public.get_superadmin_product_experiment_header(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_superadmin_product_experiment_header(uuid) to authenticated;

-- Existing fixture and service insertions resolve the same immutable scope as administrative commands.
create function private.set_product_publication_scope() returns trigger
language plpgsql set search_path='' as $$
begin
 select sc.season_id,season.room_id into new.season_id,new.room_id from public.scheduled_challenges sc join public.seasons season on season.id=sc.season_id where sc.id=new.publication_id;
 return new;
end $$;
revoke all on function private.set_product_publication_scope() from public,anon,authenticated,service_role;
create trigger set_product_publication_scope before insert on private.product_experiment_publications for each row execute function private.set_product_publication_scope();

create or replace function public.purge_product_measurements() returns integer
language plpgsql volatile security definer set search_path='' as $$
declare e private.product_experiments%rowtype; n integer:=0;
begin
 for e in select * from private.product_experiments where purge_at<=clock_timestamp() and purged_at is null for update skip locked loop
   delete from private.product_events where experiment_id=e.id;
   delete from private.product_ratings where experiment_id=e.id;
   delete from private.product_experiment_journal where experiment_id=e.id;
   delete from private.product_measurement_commands where experiment_id=e.id;
   -- Keep only aggregate metrics and the result, never per-person rows or unknown-data notes.
   update private.product_measurement_snapshots set sources=null,report=(report-'cells'-'participants'-'limitations')||jsonb_build_object('cells','[]'::jsonb,'participants','[]'::jsonb,'limitations',jsonb_build_array('Registros identificables eliminados.'),'metrics',coalesce((select jsonb_agg(m) from jsonb_array_elements(report->'metrics') m where coalesce(m->>'scope',case when m->>'id' ~ '^M07-P' then 'participant' else 'aggregate' end)='aggregate'),'[]'::jsonb)) where experiment_id=e.id;
   update private.product_experiment_participants set private_reference=null,player_id=null,invited_at=null,response='pending',access_at=null where experiment_id=e.id;
   update private.product_experiments set purged_at=clock_timestamp(),channel='' where id=e.id;
   n:=n+1;
 end loop;
 return n;
end $$;
