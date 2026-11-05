-- Preview and apply use the same complete validation. No caller-provided actor or bypass flags.
create function private.preview_calendar_change(input jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  season public.seasons%rowtype; publication public.scheduled_challenges%rowtype;
  change jsonb; changes jsonb := '[]'; starts_value timestamptz; ends_value timestamptz;
  opens_value timestamptz; closes_value timestamptz; instant timestamptz := clock_timestamp();
begin
  if not exists(select 1 from private.platform_role_assignments where player_id=private.current_player_id() and role='superadmin') then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object' or not input ?& array['seasonId','expectedUpdatedAt','startsAt','endsAt','publications']
    or jsonb_typeof(input->'publications') is distinct from 'array'
    or exists(select 1 from jsonb_object_keys(input) k where k<>all(array['seasonId','expectedUpdatedAt','startsAt','endsAt','publications'])) then
    raise exception 'invalid_command' using errcode='22023';
  end if;
  select s.* into season from public.seasons s join public.rooms r on r.id=s.room_id and r.status='active' where s.id=(input->>'seasonId')::uuid;
  if not found then raise exception 'season_not_found' using errcode='22023'; end if;
  if (input->>'expectedUpdatedAt')::timestamptz is distinct from season.updated_at then raise exception 'schedule_conflict' using errcode='40001'; end if;
  starts_value:=(input->>'startsAt')::timestamptz; ends_value:=(input->>'endsAt')::timestamptz;
  perform private.assert_season_calendar_window(season,starts_value,ends_value,instant);
  if exists(select 1 from jsonb_array_elements(input->'publications') c group by c->>'scheduledChallengeId' having count(*)>1) then
    raise exception 'invalid_command' using errcode='22023';
  end if;
  for change in select value from jsonb_array_elements(input->'publications') loop
    if jsonb_typeof(change) is distinct from 'object' or not change ?& array['scheduledChallengeId','expectedUpdatedAt','opensAt','closesAt']
      or exists(select 1 from jsonb_object_keys(change) k where k<>all(array['scheduledChallengeId','expectedUpdatedAt','opensAt','closesAt'])) then
      raise exception 'invalid_command' using errcode='22023';
    end if;
    select * into publication from public.scheduled_challenges where id=(change->>'scheduledChallengeId')::uuid and season_id=season.id;
    if not found then raise exception 'schedule_not_found' using errcode='22023'; end if;
    if (change->>'expectedUpdatedAt')::timestamptz is distinct from publication.updated_at then raise exception 'schedule_conflict' using errcode='40001'; end if;
    opens_value:=(change->>'opensAt')::timestamptz; closes_value:=(change->>'closesAt')::timestamptz;
    perform private.assert_publication_calendar_window(publication,opens_value,closes_value,instant);
    changes:=changes||jsonb_build_array(jsonb_build_object('scheduledChallengeId',publication.id,'number',publication.number,
      'before',jsonb_build_object('opensAt',publication.opens_at,'closesAt',publication.closes_at),
      'after',jsonb_build_object('opensAt',opens_value,'closesAt',closes_value)));
  end loop;
  if exists(
    select 1 from public.scheduled_challenges p left join jsonb_array_elements(input->'publications') c on (c->>'scheduledChallengeId')::uuid=p.id
    where p.season_id=season.id and p.status<>'cancelled' and
      (coalesce((c->>'opensAt')::timestamptz,p.opens_at)<starts_value or coalesce((c->>'closesAt')::timestamptz,p.closes_at)>ends_value)
  ) then raise exception 'schedule_outside_season' using errcode='23514'; end if;
  if exists(
    with windows as (
      select p.id,coalesce((c->>'opensAt')::timestamptz,p.opens_at) opens_at,coalesce((c->>'closesAt')::timestamptz,p.closes_at) closes_at
      from public.scheduled_challenges p left join jsonb_array_elements(input->'publications') c on (c->>'scheduledChallengeId')::uuid=p.id
      where p.season_id=season.id and p.status<>'cancelled'
    ) select 1 from windows a join windows b on a.id<b.id and tstzrange(a.opens_at,a.closes_at,'[)') && tstzrange(b.opens_at,b.closes_at,'[)')
  ) then raise exception 'schedule_overlap' using errcode='23P01'; end if;
  return jsonb_build_object('evaluatedAt',instant,'roomId',season.room_id,'seasonId',season.id,
    'season',jsonb_build_object('before',jsonb_build_object('startsAt',season.starts_at,'endsAt',season.ends_at),
      'after',jsonb_build_object('startsAt',starts_value,'endsAt',ends_value)), 'publications',changes);
end $$;

create function public.preview_superadmin_calendar_change(input jsonb) returns jsonb
language sql stable security definer set search_path='' as $$ select private.preview_calendar_change(input); $$;

create function public.apply_superadmin_calendar_change(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.current_player_id(); key text:=btrim(input->>'idempotencyKey'); reason_value text:=btrim(input->>'reason');
  proposal jsonb:=input-'idempotencyKey'-'reason'; cached private.command_requests%rowtype;
  season public.seasons%rowtype; change jsonb; preview jsonb; changed boolean:=false;
begin
  if not exists(select 1 from private.platform_role_assignments where player_id=actor and role='superadmin') then raise exception 'not_authorized' using errcode='42501'; end if;
  if key is null or char_length(key) not between 8 and 160 or reason_value is null or char_length(reason_value) not between 1 and 500 then raise exception 'invalid_command' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('superadmin-calendar-command:'||actor||':'||key,0));
  select * into cached from private.command_requests where actor_id=actor and idempotency_key=key;
  if found then
    if cached.operation<>'apply_calendar_change' or cached.input<>input then raise exception 'idempotency_conflict' using errcode='40001'; end if;
    return cached.result;
  end if;
  select * into season from public.seasons where id=(proposal->>'seasonId')::uuid;
  if not found then raise exception 'season_not_found' using errcode='22023'; end if;
  perform 1 from public.rooms where id=season.room_id for update;
  select * into season from public.seasons where id=season.id for update;
  perform 1 from public.scheduled_challenges where season_id=season.id order by id for update;
  preview:=private.preview_calendar_change(proposal);
  set constraints public.scheduled_challenges_season_id_tstzrange_excl,public.season_calendar_containment,public.publication_calendar_containment deferred;
  if (season.starts_at,season.ends_at) is distinct from ((proposal->>'startsAt')::timestamptz,(proposal->>'endsAt')::timestamptz) then
    update public.seasons set starts_at=(proposal->>'startsAt')::timestamptz,ends_at=(proposal->>'endsAt')::timestamptz where id=season.id;
    changed:=true;
  end if;
  for change in select value from jsonb_array_elements(proposal->'publications') loop
    update public.scheduled_challenges set opens_at=(change->>'opensAt')::timestamptz,closes_at=(change->>'closesAt')::timestamptz,
      status=case when status='open' and opens_at>clock_timestamp() then 'scheduled' else status end
    where id=(change->>'scheduledChallengeId')::uuid and (opens_at,closes_at) is distinct from ((change->>'opensAt')::timestamptz,(change->>'closesAt')::timestamptz);
    changed:=changed or found;
  end loop;
  set constraints public.scheduled_challenges_season_id_tstzrange_excl,public.season_calendar_containment,public.publication_calendar_containment immediate;
  preview:=preview||jsonb_build_object('changed',changed);
  if changed then
    insert into private.audit_log(actor_player_id,action,entity_type,entity_id,reason,request_id,before_payload,after_payload)
      values(actor,'apply_calendar_change','season',season.id,reason_value,key,preview-'changed',proposal);
  end if;
  insert into private.command_requests(actor_id,idempotency_key,operation,input,result) values(actor,key,'apply_calendar_change',input,preview);
  return preview;
end $$;

alter function private.preview_calendar_change(jsonb) owner to postgres;
alter function public.preview_superadmin_calendar_change(jsonb) owner to postgres;
alter function public.apply_superadmin_calendar_change(jsonb) owner to postgres;
revoke all on function private.preview_calendar_change(jsonb), public.preview_superadmin_calendar_change(jsonb), public.apply_superadmin_calendar_change(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.preview_superadmin_calendar_change(jsonb),public.apply_superadmin_calendar_change(jsonb) to authenticated;
