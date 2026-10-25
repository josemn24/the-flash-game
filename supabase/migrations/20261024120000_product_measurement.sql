-- Tabarnia daily-v2: private observational data. No changes to competitive facts.
create table private.product_experiments (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id),
 season_id uuid not null references public.seasons(id), protocol text not null default 'tabarnia-daily-v2' check(protocol='tabarnia-daily-v2'),
 channel text not null default '', state text not null default 'draft' check(state in ('draft','frozen','running','closed')),
 frozen_at timestamptz, closed_at timestamptz, purge_at timestamptz, purged_at timestamptz,
 created_at timestamptz not null default clock_timestamp(), revision integer not null default 1,
 unique(season_id)
);
create table private.product_experiment_publications (
 experiment_id uuid not null references private.product_experiments(id), publication_id uuid not null references public.scheduled_challenges(id),
 position integer not null check(position between 1 and 9), challenge_version_id uuid not null references private.challenge_versions(id),
 opens_at timestamptz not null, closes_at timestamptz not null, mode text not null,
 primary key(experiment_id,position), unique(experiment_id,publication_id), check(closes_at-opens_at=interval '24 hours')
);
create table private.product_experiment_participants (
 experiment_id uuid not null references private.product_experiments(id), code text not null check(code ~ '^P(0[1-9]|1[0-4])$'),
 private_reference text check(length(private_reference)<=200), player_id uuid references public.players(id),
 invited_at timestamptz, response text not null default 'pending' check(response in ('pending','accepted','declined')), access_at timestamptz,
 primary key(experiment_id,code), unique(experiment_id,player_id)
);
create table private.product_events (
 event_id uuid primary key, experiment_id uuid not null, participant_code text not null,
 publication_id uuid, type text not null check(type in ('room_viewed','challenge_intro_viewed','ranking_viewed','review_viewed','rehearsal_started','rehearsal_completed')),
 visit_id uuid not null, occurred_at timestamptz not null, received_at timestamptz not null default clock_timestamp(), app_version text not null check(length(app_version) between 1 and 80),
 event_version integer not null default 1 check(event_version=1),
 foreign key(experiment_id,participant_code) references private.product_experiment_participants(experiment_id,code),
 foreign key(experiment_id,publication_id) references private.product_experiment_publications(experiment_id,publication_id),
 unique(experiment_id,participant_code,type,visit_id,publication_id)
);
create index product_events_experiment_time_idx on private.product_events(experiment_id,received_at);
create unique index product_events_room_visit_idx on private.product_events(experiment_id,participant_code,type,visit_id) where publication_id is null;
create table private.product_ratings (
 id uuid primary key, experiment_id uuid not null, participant_code text not null, publication_id uuid not null,
 value integer not null check(value between 1 and 5), received_at timestamptz not null default clock_timestamp(),
 foreign key(experiment_id,participant_code) references private.product_experiment_participants(experiment_id,code),
 foreign key(experiment_id,publication_id) references private.product_experiment_publications(experiment_id,publication_id)
);
create index product_ratings_latest_idx on private.product_ratings(experiment_id,publication_id,participant_code,received_at desc);
create table private.product_experiment_journal (
 id uuid primary key default gen_random_uuid(), experiment_id uuid not null references private.product_experiments(id),
 kind text not null check(kind in ('announcement','support','incident','work','cost','feedback','deviation')),
 source text not null default '', topic text not null default '', note text not null check(length(note) between 1 and 2000),
 participant_codes text[] not null default '{}', publication_ids uuid[] not null default '{}',
 occurred_at timestamptz not null, recorded_at timestamptz not null default clock_timestamp(),
 minutes numeric check(minutes>=0), amount numeric check(amount>=0), allocation text, resolved_at timestamptz,
 non_evaluable boolean not null default false, revision integer not null default 1
);
create index product_journal_experiment_idx on private.product_experiment_journal(experiment_id,occurred_at);
create table private.product_measurement_snapshots (
 id uuid primary key default gen_random_uuid(), experiment_id uuid not null references private.product_experiments(id),
 kind text not null check(kind in ('primary','final')), revision integer not null, created_at timestamptz not null default clock_timestamp(),
 cutoff timestamptz not null, report jsonb not null, sources jsonb, unique(experiment_id,revision)
);
-- Idempotency data is separate from the global command log so retention also removes identifiers.
create table private.product_measurement_commands (
 experiment_id uuid not null references private.product_experiments(id), key text not null, actor_id uuid not null references public.players(id),
 input jsonb not null, result jsonb not null, created_at timestamptz not null default clock_timestamp(), primary key(experiment_id,key)
);
alter table private.product_experiments enable row level security;
alter table private.product_experiment_publications enable row level security;
alter table private.product_experiment_participants enable row level security;
alter table private.product_events enable row level security;
alter table private.product_ratings enable row level security;
alter table private.product_experiment_journal enable row level security;
alter table private.product_measurement_snapshots enable row level security;
alter table private.product_measurement_commands enable row level security;
revoke all on private.product_experiments,private.product_experiment_publications,private.product_experiment_participants,private.product_events,private.product_ratings,private.product_experiment_journal,private.product_measurement_snapshots,private.product_measurement_commands from public,anon,authenticated,service_role;

create function private.require_measurement_admin() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_player_id();
begin
 if actor is null or not exists(select 1 from private.platform_role_assignments where player_id=actor and role='superadmin') then raise exception 'not_authorized' using errcode='42501'; end if;
 return actor;
end $$;

create function public.get_superadmin_product_experiments(target_room_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_measurement_admin();
 return coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from private.product_experiments e where room_id=target_room_id),'[]'::jsonb);
end $$;

create function public.get_superadmin_product_experiment(target_experiment_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e private.product_experiments%rowtype;
begin
 perform private.require_measurement_admin();
 select * into e from private.product_experiments where id=target_experiment_id;
 if not found then return null; end if;
 return jsonb_build_object('experiment',to_jsonb(e)||jsonb_build_object('design_changed',exists(select 1 from private.product_experiment_publications frozen join public.scheduled_challenges actual on actual.id=frozen.publication_id where frozen.experiment_id=e.id and (actual.opens_at<>frozen.opens_at or actual.closes_at<>frozen.closes_at or actual.challenge_version_id<>frozen.challenge_version_id or actual.season_id<>e.season_id or actual.status='cancelled'))),'now',clock_timestamp(),
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
 'snapshots',coalesce((select jsonb_agg(to_jsonb(s)-'experiment_id' order by revision desc) from private.product_measurement_snapshots s where experiment_id=e.id),'[]'::jsonb));
end $$;

create function public.manage_product_experiment(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.require_measurement_admin(); op text:=input->>'op'; k text:=input->>'idempotencyKey';
 e private.product_experiments%rowtype; p private.product_experiment_participants%rowtype; j private.product_experiment_journal%rowtype;
 cached private.product_measurement_commands%rowtype; item jsonb; idx integer; result jsonb; before_value jsonb;
 total integer; finish timestamptz; sid uuid; next_revision integer; instant timestamptz:=clock_timestamp();
begin
 if jsonb_typeof(input)<>'object' or k is null or length(k) not between 8 and 160 then raise exception 'invalid_command' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('measurement:'||actor||':'||k,0));
 if op='create' then
   select * into e from private.product_experiments where season_id=(input->>'seasonId')::uuid;
   if not found then
     if not exists(select 1 from public.seasons where id=(input->>'seasonId')::uuid and room_id=(input->>'roomId')::uuid and status='draft') then raise exception 'invalid_season' using errcode='22023'; end if;
     insert into private.product_experiments(room_id,season_id,channel) values((input->>'roomId')::uuid,(input->>'seasonId')::uuid,left(coalesce(input->>'channel',''),500)) returning * into e;
     for idx in 1..14 loop
       insert into private.product_experiment_participants(experiment_id,code,private_reference) values(e.id,'P'||lpad(idx::text,2,'0'),'');
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
 before_value:=to_jsonb(e)-'channel';
 if op='configure' then
   if e.state<>'draft' or jsonb_array_length(input->'publicationIds')<>9 then raise exception 'invalid_design' using errcode='22023'; end if;
   delete from private.product_experiment_publications where experiment_id=e.id;
   idx:=0;
   for item in select value from jsonb_array_elements(input->'publicationIds') loop
     idx:=idx+1;
     insert into private.product_experiment_publications(experiment_id,publication_id,position,challenge_version_id,opens_at,closes_at,mode)
       select e.id,s.id,idx,s.challenge_version_id,s.opens_at,s.closes_at,v.mode from public.scheduled_challenges s join private.challenge_versions v on v.id=s.challenge_version_id
       where s.id=(item#>>'{}')::uuid and s.season_id=e.season_id and s.status<>'cancelled';
     if not found then raise exception 'invalid_publication' using errcode='22023'; end if;
   end loop;
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
   if nullif(input->>'playerId','') is not null and exists(select 1 from private.platform_role_assignments where player_id=(input->>'playerId')::uuid and role='superadmin') then raise exception 'operational_account_excluded' using errcode='22023'; end if;
   if nullif(input->>'invitedAt','')::timestamptz>instant or nullif(input->>'accessAt','')::timestamptz>instant then raise exception 'invalid_date' using errcode='22023'; end if;
   if e.state='draft' and nullif(input->>'invitedAt','') is not null then raise exception 'freeze_before_inviting' using errcode='22023'; end if;
   update private.product_experiment_participants set private_reference=nullif(input->>'privateReference',''),player_id=nullif(input->>'playerId','')::uuid,
     invited_at=nullif(input->>'invitedAt','')::timestamptz,response=coalesce(input->>'response','pending'),access_at=nullif(input->>'accessAt','')::timestamptz where experiment_id=e.id and code=p.code;
   if e.state='frozen' and nullif(input->>'invitedAt','') is not null then update private.product_experiments set state='running' where id=e.id; end if;
   before_value:=to_jsonb(p);
 elsif op='freeze' then
   if e.state<>'draft' or btrim(e.channel)='' then raise exception 'invalid_design' using errcode='22023'; end if;
   select count(*) into total from private.product_experiment_publications where experiment_id=e.id;
   if total<>9 or exists(select 1 from private.product_experiment_publications a join private.product_experiment_publications b on b.experiment_id=a.experiment_id and b.position=a.position+1 where a.experiment_id=e.id and a.closes_at<>b.opens_at)
     or exists(select 1 from private.product_experiment_participants where experiment_id=e.id and nullif(btrim(private_reference),'') is null)
     or (select count(distinct lower(btrim(private_reference))) from private.product_experiment_participants where experiment_id=e.id)<>14
     or (select min(opens_at) from private.product_experiment_publications where experiment_id=e.id)<=instant then raise exception 'invalid_design' using errcode='22023'; end if;
   update private.product_experiments set state='frozen',frozen_at=instant where id=e.id;
 elsif op='journal' then
   if input->>'kind'='cost' and (nullif(input->>'amount','') is null or nullif(btrim(input->>'allocation'),'') is null) then raise exception 'invalid_cost' using errcode='22023'; end if;
   -- Corrections after closing create a new audited revision; stored snapshots stay unchanged.
   if exists(select 1 from jsonb_array_elements_text(coalesce(input->'participantCodes','[]'::jsonb)) c where not exists(select 1 from private.product_experiment_participants p where p.experiment_id=e.id and p.code=c.value))
     or exists(select 1 from jsonb_array_elements_text(coalesce(input->'publicationIds','[]'::jsonb)) c where not exists(select 1 from private.product_experiment_publications p where p.experiment_id=e.id and p.publication_id=c.value::uuid)) then raise exception 'invalid_context' using errcode='22023'; end if;
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
   if e.state not in ('running','closed') or finish is null or instant<finish+interval '24 hours' or (input->>'kind'='final' and instant<finish+interval '168 hours') then raise exception 'cutoff_not_reached' using errcode='22023'; end if;
   if jsonb_typeof(input->'report') is distinct from 'object' or input->'report'->>'protocol' is distinct from 'tabarnia-daily-v2' or jsonb_array_length(input->'report'->'cells') is distinct from 126 or (input->'report'->>'cutoff')::timestamptz<>finish+interval '24 hours' then raise exception 'invalid_snapshot' using errcode='22023'; end if;
   select coalesce(max(revision),0)+1 into next_revision from private.product_measurement_snapshots where experiment_id=e.id;
   insert into private.product_measurement_snapshots(experiment_id,kind,revision,cutoff,report,sources)
     values(e.id,input->>'kind',next_revision,finish+interval '24 hours',input->'report',input->'sources') returning id into sid;
   if input->>'kind'='final' and e.closed_at is null then update private.product_experiments set state='closed',closed_at=instant,purge_at=instant+interval '2160 hours' where id=e.id; end if;
 elsif op<>'create' then raise exception 'invalid_operation' using errcode='22023';
 end if;
 update private.product_experiments set revision=revision+1 where id=e.id returning * into e;
 result:=jsonb_build_object('experimentId',e.id,'revision',e.revision,'snapshotId',case when op='snapshot' then sid else null end);
 -- Full before/after records live in retention-scoped command revisions, not global audit.
 insert into private.product_measurement_commands(experiment_id,key,actor_id,input,result) values(e.id,k,actor,jsonb_build_object('command',input,'before',before_value),result);
 -- Compare idempotency against the command envelope on retries below.
 return result;
end $$;

create function public.record_product_event(input jsonb) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.current_player_id(); e private.product_experiments%rowtype; code_value text; now_value timestamptz:=clock_timestamp(); pid uuid:=nullif(input->>'publicationId','')::uuid; previous private.product_events%rowtype;
begin
 if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if jsonb_typeof(input)<>'object' or exists(select 1 from jsonb_object_keys(input) k where not k=any(array['eventId','type','roomId','publicationId','visitId','occurredAt','appVersion']))
   or input->>'type' not in ('room_viewed','challenge_intro_viewed','ranking_viewed','review_viewed','rehearsal_started','rehearsal_completed') then raise exception 'invalid_event' using errcode='22023'; end if;
 select ex.* into e from private.product_experiments ex
 join public.rooms r on r.id=ex.room_id join private.product_experiment_participants p on p.experiment_id=ex.id and p.player_id=actor
 join public.room_memberships m on m.room_id=r.id and m.player_id=actor
 where r.slug=input->>'roomId' and r.status='active' and m.status='active' and m.role<>'spectator'
 and ex.state='running' and ex.purged_at is null and p.invited_at<=now_value and not exists(select 1 from private.platform_role_assignments where player_id=actor)
 and (pid is null or exists(select 1 from private.product_experiment_publications pub where pub.experiment_id=ex.id and pub.publication_id=pid))
 and now_value<=(select max(closes_at)+interval '24 hours' from private.product_experiment_publications where experiment_id=ex.id)
 order by ex.created_at desc limit 1;
 if e.id is null then return false; end if;
 select p.code into code_value from private.product_experiment_participants p where p.experiment_id=e.id and p.player_id=actor;
 if pid is null and input->>'type' not in ('room_viewed','ranking_viewed') then raise exception 'invalid_context' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('product-event:'||e.id||':'||code_value,0));
 select * into previous from private.product_events where event_id=(input->>'eventId')::uuid;
 if found then
   if previous.experiment_id<>e.id or previous.participant_code<>code_value or previous.type<>input->>'type' or previous.visit_id<>(input->>'visitId')::uuid or previous.publication_id is distinct from pid then raise exception 'idempotency_conflict' using errcode='40001'; end if;
   return true;
 end if;
 if (select count(*) from private.product_events where experiment_id=e.id and participant_code=code_value and received_at>now_value-interval '1 minute')>=60 then raise exception 'measurement_rate_limited' using errcode='P0001'; end if;
 insert into private.product_events(event_id,experiment_id,participant_code,publication_id,type,visit_id,occurred_at,app_version)
 values((input->>'eventId')::uuid,e.id,code_value,pid,input->>'type',(input->>'visitId')::uuid,(input->>'occurredAt')::timestamptz,input->>'appVersion') on conflict do nothing;
 return true;
end $$;

create function public.read_my_product_rating(publication_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_player_id(); ex_id uuid; code_value text; finish timestamptz; rating integer;
begin
 if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
 select e.id,p.code,(select max(closes_at)+interval '168 hours' from private.product_experiment_publications where experiment_id=e.id)
 into ex_id,code_value,finish
 from private.product_experiments e join private.product_experiment_publications pub on pub.experiment_id=e.id
 join private.product_experiment_participants p on p.experiment_id=e.id and p.player_id=actor
 join public.room_memberships m on m.room_id=e.room_id and m.player_id=actor
 join public.rooms r on r.id=e.room_id
 where pub.publication_id=read_my_product_rating.publication_id and e.state in ('running','closed') and e.purged_at is null
 and m.status='active' and m.role<>'spectator' and r.status='active' and not exists(select 1 from private.platform_role_assignments where player_id=actor)
 and exists(select 1 from public.attempts a where a.player_id=actor and a.scheduled_challenge_id=pub.publication_id and a.kind='competitive' and a.status='completed' and a.started_at>=pub.opens_at and a.started_at<pub.closes_at);
 if ex_id is null then return jsonb_build_object('eligible',false,'value',null); end if;
 select value into rating from private.product_ratings where experiment_id=ex_id and participant_code=code_value and product_ratings.publication_id=read_my_product_rating.publication_id order by received_at desc,id desc limit 1;
 return jsonb_build_object('eligible',statement_timestamp()<=finish,'value',rating,'closesAt',finish);
end $$;
create function public.save_my_product_rating(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.current_player_id(); eligibility jsonb; ex_id uuid; code_value text; previous private.product_ratings%rowtype;
begin
 if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(input) k where not k=any(array['id','publicationId','value'])) or (input->>'value')::integer not between 1 and 5 then raise exception 'invalid_rating' using errcode='22023'; end if;
 eligibility:=public.read_my_product_rating((input->>'publicationId')::uuid);
 if eligibility->>'closesAt' is null then raise exception 'not_authorized' using errcode='42501'; end if;
 perform 1 from public.attempts where player_id=actor and scheduled_challenge_id=(input->>'publicationId')::uuid and kind='competitive' and status='completed' for share;
 if not found then raise exception 'not_authorized' using errcode='42501'; end if;
 select e.id,p.code into ex_id,code_value from private.product_experiments e join private.product_experiment_publications pub on pub.experiment_id=e.id
 join private.product_experiment_participants p on p.experiment_id=e.id and p.player_id=actor where pub.publication_id=(input->>'publicationId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('rating:'||ex_id||':'||code_value||':'||(input->>'publicationId'),0));
 select * into previous from private.product_ratings where id=(input->>'id')::uuid;
 if found then
   if previous.experiment_id<>ex_id or previous.participant_code<>code_value or previous.publication_id<>(input->>'publicationId')::uuid or previous.value<>(input->>'value')::integer then raise exception 'idempotency_conflict' using errcode='40001'; end if;
 else
   if clock_timestamp()>(eligibility->>'closesAt')::timestamptz then raise exception 'not_authorized' using errcode='42501'; end if;
   if (select count(*) from private.product_ratings where experiment_id=ex_id and participant_code=code_value and received_at>clock_timestamp()-interval '1 minute')>=60 then raise exception 'measurement_rate_limited'; end if;
   insert into private.product_ratings(id,experiment_id,participant_code,publication_id,value) values((input->>'id')::uuid,ex_id,code_value,(input->>'publicationId')::uuid,(input->>'value')::integer);
 end if;
 return public.read_my_product_rating((input->>'publicationId')::uuid);
end $$;

create function public.purge_product_measurements() returns integer
language plpgsql volatile security definer set search_path='' as $$
declare e private.product_experiments%rowtype; n integer:=0;
begin
 for e in select * from private.product_experiments where purge_at<=clock_timestamp() and purged_at is null for update skip locked loop
   delete from private.product_events where experiment_id=e.id;
   delete from private.product_ratings where experiment_id=e.id;
   delete from private.product_experiment_journal where experiment_id=e.id;
   delete from private.product_measurement_commands where experiment_id=e.id;
   -- Keep only aggregate metrics and the result, never per-person rows or unknown-data notes.
   update private.product_measurement_snapshots set sources=null,report=(report-'cells'-'participants'-'limitations')||jsonb_build_object('cells','[]'::jsonb,'participants','[]'::jsonb,'limitations',jsonb_build_array('Registros identificables eliminados.'),'metrics',coalesce((select jsonb_agg(m) from jsonb_array_elements(report->'metrics') m where m->>'id' !~ '^M07-P'),'[]'::jsonb)) where experiment_id=e.id;
   update private.product_experiment_participants set private_reference=null,player_id=null,invited_at=null,response='pending',access_at=null where experiment_id=e.id;
   update private.product_experiments set purged_at=clock_timestamp(),channel='' where id=e.id;
   n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function private.require_measurement_admin(),public.get_superadmin_product_experiments(uuid),public.get_superadmin_product_experiment(uuid),public.manage_product_experiment(jsonb),public.record_product_event(jsonb),public.read_my_product_rating(uuid),public.save_my_product_rating(jsonb),public.purge_product_measurements() from public,anon,authenticated,service_role;
grant execute on function public.get_superadmin_product_experiments(uuid),public.get_superadmin_product_experiment(uuid),public.manage_product_experiment(jsonb),public.record_product_event(jsonb),public.read_my_product_rating(uuid),public.save_my_product_rating(jsonb) to authenticated;
grant execute on function public.purge_product_measurements() to service_role;

-- Activation is explicit; measurement capture never gates an attempt.
create function private.guard_product_experiment_launch() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare e private.product_experiments%rowtype; t0 timestamptz;
begin
 if new.status<>'active' or old.status='active' then return new; end if;
 select * into e from private.product_experiments where season_id=new.id and purged_at is null for update;
 if e.id is null then return new; end if;
 select min(opens_at) into t0 from private.product_experiment_publications where experiment_id=e.id;
 if t0 is null or clock_timestamp()>t0 or e.state<>'running' or (select count(*) from private.product_experiment_participants p join public.room_memberships m on m.player_id=p.player_id and m.room_id=e.room_id and m.status='active' and m.role<>'spectator' where p.experiment_id=e.id and p.invited_at is not null and p.invited_at<=clock_timestamp() and p.invited_at<t0 and p.access_at is not null and p.access_at<=clock_timestamp() and p.access_at<=t0)<>14
 then raise exception 'experiment_not_ready' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function private.guard_product_experiment_launch() from public,anon,authenticated,service_role;
create trigger guard_product_experiment_launch before update of status on public.seasons for each row execute function private.guard_product_experiment_launch();

create function private.audit_product_publication_change() returns trigger
language plpgsql volatile security definer set search_path='' as $$
begin
 if (new.opens_at,new.closes_at,new.challenge_version_id,new.season_id) is distinct from (old.opens_at,old.closes_at,old.challenge_version_id,old.season_id) or (new.status='cancelled' and old.status<>'cancelled') then
   insert into private.product_experiment_journal(experiment_id,kind,source,topic,note,publication_ids,occurred_at)
   select e.id,'deviation','calendar','calendar',jsonb_build_object('before',jsonb_build_object('opens',old.opens_at,'closes',old.closes_at,'version',old.challenge_version_id,'season',old.season_id,'status',old.status),'after',jsonb_build_object('opens',new.opens_at,'closes',new.closes_at,'version',new.challenge_version_id,'season',new.season_id,'status',new.status))::text,array[old.id],clock_timestamp()
   from private.product_experiments e join private.product_experiment_publications p on p.experiment_id=e.id where p.publication_id=old.id and e.state<>'draft' and e.purged_at is null;
   update private.product_experiments e set revision=revision+1 where e.state<>'draft' and e.purged_at is null and exists(select 1 from private.product_experiment_publications p where p.experiment_id=e.id and p.publication_id=old.id);
 end if;
 return new;
end $$;
revoke all on function private.audit_product_publication_change() from public,anon,authenticated,service_role;
create trigger audit_product_publication_change after update on public.scheduled_challenges for each row execute function private.audit_product_publication_change();
