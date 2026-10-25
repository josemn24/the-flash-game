-- Keep the applied measurement migration immutable; repair journal context validation.
create or replace function public.manage_product_experiment(input jsonb) returns jsonb
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
