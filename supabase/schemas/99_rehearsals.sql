-- Generation is repository-backed. PostgreSQL authorizes templates and publication policy only.
create table private.rehearsal_publication_policies (
  scheduled_challenge_id uuid primary key references public.scheduled_challenges(id) on delete cascade,
  enabled boolean not null default true,
  updated_by_player_id uuid not null references public.players(id),
  updated_at timestamptz not null default statement_timestamp()
);
alter table private.rehearsal_publication_policies enable row level security;
revoke all on private.rehearsal_publication_policies from public, anon, authenticated, service_role;

create function private.rehearsal_template(version_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('challengeVersionId',v.id,'title',v.title,'mode',v.mode,
    'globalTimeLimitMs',v.global_time_limit_ms,'modeConfig',v.mode_config,'questions',coalesce((
      select jsonb_agg(jsonb_build_object('type',q.type,'payloadSchemaVersion',q.payload_schema_version,
        'difficulty',q.difficulty,'timeLimitMs',q.time_limit_ms,'points',i.points,
        'modeConfig',i.mode_config,'publicPayload',q.public_payload) order by i.position)
      from private.challenge_items i join private.question_versions q on q.id=i.question_version_id
      where i.challenge_version_id=v.id),'[]'::jsonb))
  from private.challenge_versions v where v.id=version_id
    and v.mode in ('flash','survival','pyramid','alphabet','time-trial')
$$;

create function private.read_player_rehearsal_template(room_slug text, publication_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object('template',private.rehearsal_template(v.id),'enabled',coalesce(policy.enabled,true)) into result
  from public.scheduled_challenges p join public.seasons season on season.id=p.season_id
  join public.rooms room on room.id=season.room_id
  join public.room_memberships m on m.room_id=room.id
  join private.challenge_versions v on v.id=p.challenge_version_id
  left join private.rehearsal_publication_policies policy on policy.scheduled_challenge_id=p.id
  where room.slug=room_slug and p.id=publication_id and room.status='active'
    and m.player_id=private.current_player_id() and m.status='active' and m.role<>'spectator'
    and v.mode in ('flash','survival','pyramid','alphabet','time-trial') and v.status in ('published','archived')
    and private.publication_effective_status(p.status,season.status,season.starts_at,season.ends_at,p.opens_at,p.closes_at,statement_timestamp()) in ('upcoming','available')
    and not exists(select 1 from public.attempts a where a.scheduled_challenge_id=p.id and a.player_id=m.player_id and a.kind='competitive');
  return result;
end $$;

create function private.read_editorial_rehearsal_template(version_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from private.platform_role_assignments where player_id=private.current_player_id() and role='superadmin') then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  select jsonb_build_object('template',private.rehearsal_template(v.id),'status',v.status,
    'publications',coalesce((select jsonb_agg(jsonb_build_object('publicationId',p.id,'label',room.title||' · '||season.title||' · #'||p.number,'enabled',coalesce(policy.enabled,true),'updatedAt',policy.updated_at) order by p.id)
      from public.scheduled_challenges p join public.seasons season on season.id=p.season_id join public.rooms room on room.id=season.room_id left join private.rehearsal_publication_policies policy on policy.scheduled_challenge_id=p.id
      where p.challenge_version_id=v.id),'[]'::jsonb)) into result
  from private.challenge_versions v where v.id=version_id and v.mode in ('flash','survival','pyramid','alphabet','time-trial');
  return result;
end $$;

create function private.set_rehearsal_publication_policy(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid:=private.current_player_id(); key text:=input->>'idempotencyKey';
  cached private.command_requests%rowtype; current_policy private.rehearsal_publication_policies%rowtype;
  publication_id uuid; result jsonb;
begin
  if actor is null or not exists(select 1 from private.platform_role_assignments where player_id=actor and role='superadmin') then raise exception 'not_authorized' using errcode='42501'; end if;
  if jsonb_typeof(input) is distinct from 'object' or not input ?& array['publicationId','enabled','expectedUpdatedAt','idempotencyKey','reason']
    or jsonb_typeof(input->'enabled') is distinct from 'boolean'
    or jsonb_typeof(input->'reason') is distinct from 'string'
    or char_length(btrim(input->>'reason')) not between 1 and 500
    or key is null or char_length(key) not between 8 and 160 then raise exception 'invalid_command' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rehearsal-policy:'||actor||':'||key,0));
  select * into cached from private.command_requests where actor_id=actor and idempotency_key=key;
  if found then
    if cached.operation<>'set_rehearsal_publication_policy' or cached.input<>input then raise exception 'idempotency_conflict' using errcode='40001'; end if;
    return cached.result;
  end if;
  publication_id:=(input->>'publicationId')::uuid;
  perform 1 from public.scheduled_challenges where id=publication_id for update;
  if not found then raise exception 'content_not_found' using errcode='P0002'; end if;
  select * into current_policy from private.rehearsal_publication_policies where scheduled_challenge_id=publication_id;
  if current_policy.updated_at is distinct from (input->>'expectedUpdatedAt')::timestamptz then raise exception 'content_conflict' using errcode='40001'; end if;
  insert into private.rehearsal_publication_policies(scheduled_challenge_id,enabled,updated_by_player_id,updated_at)
    values(publication_id,(input->>'enabled')::boolean,actor,clock_timestamp())
    on conflict(scheduled_challenge_id) do update set enabled=excluded.enabled,updated_by_player_id=actor,updated_at=excluded.updated_at;
  result:=jsonb_build_object('publicationId',publication_id,'enabled',input->'enabled');
  insert into private.audit_log(actor_player_id,action,entity_type,entity_id,reason,request_id,before_payload,after_payload)
    values(actor,'set_rehearsal_publication_policy','scheduled_challenge',publication_id,input->>'reason',key,to_jsonb(current_policy),result);
  insert into private.command_requests(actor_id,idempotency_key,operation,input,result) values(actor,key,'set_rehearsal_publication_policy',input,result);
  return result;
end $$;
revoke all on function private.rehearsal_template(uuid), private.read_player_rehearsal_template(text,uuid),
  private.read_editorial_rehearsal_template(uuid),private.set_rehearsal_publication_policy(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.read_player_rehearsal_template(text,uuid),private.read_editorial_rehearsal_template(uuid),private.set_rehearsal_publication_policy(jsonb) to service_role;
