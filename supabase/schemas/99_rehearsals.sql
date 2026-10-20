-- Rehearsals contain repository references only. All functions are server-only.
create table private.challenge_rehearsals (
  challenge_version_id uuid primary key references private.challenge_versions(id) on delete cascade,
  rehearsal_id text not null check (rehearsal_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  rehearsal_version integer not null check (rehearsal_version > 0),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  assigned_by_player_id uuid not null references public.players(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.challenge_rehearsals enable row level security;

create function private.rehearsal_source(version_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('mode', v.mode, 'globalTimeLimitMs', v.global_time_limit_ms,
    'modeConfig', v.mode_config, 'questions', coalesce((
      select jsonb_agg(jsonb_build_object('type', q.type, 'payloadSchemaVersion', q.payload_schema_version,
        'timeLimitMs', q.time_limit_ms, 'points', i.points, 'modeConfig', i.mode_config,
        'publicPayload', q.public_payload, 'solutionPayload', s.solution_payload) order by i.position)
      from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
      join private.question_version_solutions s on s.question_version_id = q.id
      where i.challenge_version_id = v.id), '[]'::jsonb))
  from private.challenge_versions v where v.id = version_id
$$;

create function private.guard_rehearsal_binding() returns trigger
language plpgsql set search_path = '' as $$
declare version_status text; version_mode text;
begin
  if tg_op = 'UPDATE' and new.challenge_version_id <> old.challenge_version_id then
    raise exception 'rehearsal_binding_frozen' using errcode = '55000';
  end if;
  select status, mode into version_status, version_mode from private.challenge_versions
    where id = coalesce(new.challenge_version_id, old.challenge_version_id) for update;
  if tg_op <> 'INSERT' and version_status <> 'draft' then
    raise exception 'rehearsal_binding_frozen' using errcode = '55000';
  end if;
  if tg_op <> 'DELETE' and version_mode not in ('flash','pyramid','survival','alphabet','time-trial') then
    raise exception 'unsupported_mode' using errcode = '22023';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger rehearsal_binding_guard before insert or update or delete on private.challenge_rehearsals
  for each row execute function private.guard_rehearsal_binding();

create function private.invalidate_draft_rehearsal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare parent_id uuid;
begin
  if tg_table_name = 'challenge_versions' then
    if old.status = 'draft' and
      (to_jsonb(old) - 'updated_at' - 'status' - 'published_at') is distinct from
      (to_jsonb(new) - 'updated_at' - 'status' - 'published_at') then
      delete from private.challenge_rehearsals where challenge_version_id = new.id;
    end if;
  elsif tg_table_name = 'challenge_items' then
    parent_id := coalesce(new.challenge_version_id, old.challenge_version_id);
    delete from private.challenge_rehearsals r using private.challenge_versions v
      where r.challenge_version_id = v.id and v.id = parent_id and v.status = 'draft';
  else
    if tg_table_name = 'question_versions' then
    if tg_op = 'UPDATE' and
      (old.type, old.payload_schema_version, old.time_limit_ms, old.public_payload) is not distinct from
      (new.type, new.payload_schema_version, new.time_limit_ms, new.public_payload) then return new; end if;
    end if;
    if tg_table_name = 'question_versions' then parent_id := coalesce(new.id, old.id);
    else parent_id := coalesce(new.question_version_id, old.question_version_id); end if;
    delete from private.challenge_rehearsals r using private.challenge_items i, private.challenge_versions v
      where r.challenge_version_id = v.id and i.challenge_version_id = v.id
        and i.question_version_id = parent_id and v.status = 'draft';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger rehearsal_draft_changed before update on private.challenge_versions for each row execute function private.invalidate_draft_rehearsal();
create trigger rehearsal_items_changed after insert or update or delete on private.challenge_items for each row execute function private.invalidate_draft_rehearsal();
create trigger rehearsal_question_changed after update on private.question_versions for each row execute function private.invalidate_draft_rehearsal();
create trigger rehearsal_solution_changed after insert or update or delete on private.question_version_solutions for each row execute function private.invalidate_draft_rehearsal();

create function private.read_editorial_rehearsal(version_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from private.platform_role_assignments where player_id = private.current_player_id() and role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select jsonb_build_object('challengeVersionId', v.id, 'status', v.status, 'updatedAt', v.updated_at,
    'source', private.rehearsal_source(v.id),
    'sourceHash', encode(sha256(convert_to(private.rehearsal_source(v.id)::text, 'UTF8')), 'hex'),
    'ref', case when r.challenge_version_id is null then null else jsonb_build_object('id', r.rehearsal_id, 'version', r.rehearsal_version, 'contentHash', r.content_hash) end)
  into result from private.challenge_versions v left join private.challenge_rehearsals r on r.challenge_version_id = v.id
  where v.id = version_id and v.mode in ('flash','pyramid','survival','alphabet','time-trial');
  return result;
end $$;

create function private.set_challenge_rehearsal(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := private.current_player_id(); key text := input->>'idempotencyKey';
  v private.challenge_versions%rowtype; cached private.command_requests%rowtype; result jsonb; ref jsonb := input->'ref';
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments where player_id = actor and role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) <> 'object' or not input ?& array['idempotencyKey','challengeVersionId','expectedUpdatedAt','sourceHash','ref','reason']
    or char_length(key) not between 8 and 160 or char_length(btrim(input->>'reason')) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rehearsal:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found then
    if cached.operation <> 'set_challenge_rehearsal' or cached.input <> input then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
    return cached.result;
  end if;
  select * into v from private.challenge_versions where id = (input->>'challengeVersionId')::uuid for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if v.mode not in ('flash','pyramid','survival','alphabet','time-trial') then raise exception 'unsupported_mode' using errcode = '22023'; end if;
  if v.updated_at is distinct from (input->>'expectedUpdatedAt')::timestamptz then raise exception 'content_conflict' using errcode = '40001'; end if;
  perform 1 from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
    join private.question_version_solutions s on s.question_version_id = q.id
    where i.challenge_version_id = v.id for share of q, s;
  if input->>'sourceHash' is distinct from encode(sha256(convert_to(private.rehearsal_source(v.id)::text, 'UTF8')), 'hex') then
    raise exception 'content_conflict' using errcode = '40001';
  end if;
  if v.status <> 'draft' and (ref = 'null'::jsonb or exists (select 1 from private.challenge_rehearsals where challenge_version_id = v.id)) then
    raise exception 'rehearsal_binding_frozen' using errcode = '55000';
  end if;
  if ref = 'null'::jsonb then delete from private.challenge_rehearsals where challenge_version_id = v.id;
  else
    insert into private.challenge_rehearsals(challenge_version_id, rehearsal_id, rehearsal_version, content_hash, source_hash, assigned_by_player_id)
    values(v.id, ref->>'id', (ref->>'version')::integer, ref->>'contentHash', input->>'sourceHash', actor)
    on conflict (challenge_version_id) do update set rehearsal_id = excluded.rehearsal_id, rehearsal_version = excluded.rehearsal_version,
      content_hash = excluded.content_hash, source_hash = excluded.source_hash, assigned_by_player_id = actor, updated_at = statement_timestamp();
  end if;
  if v.status = 'draft' then update private.challenge_versions set updated_at = statement_timestamp() where id = v.id; end if;
  result := jsonb_build_object('challengeVersionId', v.id, 'ref', ref);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload)
    values(actor, 'set_challenge_rehearsal', 'challenge_version', v.id, input->>'reason', key, null, result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'set_challenge_rehearsal', input, result);
  return result;
end $$;

create function private.read_player_rehearsal(room_slug text, publication_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object('ref', jsonb_build_object('id', r.rehearsal_id, 'version', r.rehearsal_version, 'contentHash', r.content_hash),
    'source', private.rehearsal_source(v.id)) into result
  from public.scheduled_challenges p join public.seasons season on season.id = p.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships m on m.room_id = room.id
  join private.challenge_versions v on v.id = p.challenge_version_id
  join private.challenge_rehearsals r on r.challenge_version_id = v.id
  where room.slug = room_slug and p.id = publication_id and room.status = 'active'
    and m.player_id = private.current_player_id() and m.status = 'active' and m.role <> 'spectator'
    and v.status in ('published','archived')
    and private.publication_effective_status(p.status, season.status, season.starts_at, season.ends_at, p.opens_at, p.closes_at, statement_timestamp()) in ('upcoming','available')
    and not exists (select 1 from public.attempts a where a.scheduled_challenge_id = p.id and a.player_id = m.player_id and a.kind = 'competitive')
    and r.source_hash = encode(sha256(convert_to(private.rehearsal_source(v.id)::text, 'UTF8')), 'hex');
  return result;
end $$;

revoke all on private.challenge_rehearsals from public, anon, authenticated, service_role;
revoke all on function private.rehearsal_source(uuid), private.guard_rehearsal_binding(), private.invalidate_draft_rehearsal(),
  private.read_editorial_rehearsal(uuid), private.set_challenge_rehearsal(jsonb), private.read_player_rehearsal(text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.read_editorial_rehearsal(uuid), private.set_challenge_rehearsal(jsonb), private.read_player_rehearsal(text,uuid) to service_role;
