SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.manage_room_member_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text;
  room_slug_value text;
  target_player_id uuid;
  action_value text;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  room_row public.rooms%rowtype;
  actor_membership public.room_memberships%rowtype;
  target_membership public.room_memberships%rowtype;
  before_payload jsonb;
  after_payload jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','roomKey','targetPlayerId','action']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','roomKey','targetPlayerId','action'])
    )
    or input->'idempotencyKey' = 'null'::jsonb
    or input->'roomKey' = 'null'::jsonb
    or input->'targetPlayerId' = 'null'::jsonb
    or input->'action' = 'null'::jsonb
    or jsonb_typeof(input->'idempotencyKey') <> 'string'
    or jsonb_typeof(input->'roomKey') <> 'string'
    or jsonb_typeof(input->'targetPlayerId') <> 'string'
    or jsonb_typeof(input->'action') <> 'string' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  room_slug_value := btrim(input->>'roomKey');
  action_value := input->>'action';
  if char_length(key) < 8 or char_length(key) > 160 or room_slug_value = '' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if action_value not in ('grant_admin', 'revoke_admin', 'remove') then
    raise exception 'invalid_member_action' using errcode = '22023';
  end if;
  if input->>'targetPlayerId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  target_player_id := (input->>'targetPlayerId')::uuid;
  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'roomKey', room_slug_value,
    'targetPlayerId', target_player_id,
    'action', action_value
  );

  perform pg_advisory_xact_lock(hashtextextended('room-membership-command:' || actor || ':' || key, 0));
  select * into cached
  from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'manage_room_member' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into room_row
  from public.rooms room
  where room.slug = room_slug_value and room.status = 'active'
  for update;
  if not found then raise exception 'room_not_found' using errcode = '42501'; end if;

  select * into actor_membership
  from public.room_memberships membership
  where membership.room_id = room_row.id
    and membership.player_id = actor
    and membership.status = 'active'
  for update;
  if not found or actor_membership.role <> 'owner' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into target_membership
  from public.room_memberships membership
  where membership.room_id = room_row.id
    and membership.player_id = target_player_id
    and membership.status = 'active'
  for update;
  if not found then raise exception 'member_not_found' using errcode = '42501'; end if;
  if target_membership.role = 'owner' or target_membership.player_id = actor then
    raise exception 'member_is_owner' using errcode = '42501';
  end if;
  if action_value in ('grant_admin', 'revoke_admin') and target_membership.role = 'spectator' then
    raise exception 'invalid_member_role' using errcode = '22023';
  end if;

  before_payload := jsonb_build_object(
    'playerId', target_membership.player_id,
    'role', target_membership.role,
    'status', target_membership.status
  );
  if action_value = 'grant_admin' then
    update public.room_memberships
    set role = 'admin'
    where id = target_membership.id
    returning * into target_membership;
  elsif action_value = 'revoke_admin' then
    update public.room_memberships
    set role = 'member'
    where id = target_membership.id
    returning * into target_membership;
  else
    update public.room_memberships
    set status = 'removed', ended_at = clock_timestamp()
    where id = target_membership.id
    returning * into target_membership;
  end if;

  result := jsonb_build_object(
    'roomKey', room_slug_value,
    'targetPlayerId', target_membership.player_id,
    'action', action_value,
    'role', target_membership.role,
    'status', target_membership.status
  );
  after_payload := jsonb_build_object(
    'playerId', target_membership.player_id,
    'role', target_membership.role,
    'status', target_membership.status
  );
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'manage_room_member_' || action_value, 'room_membership', target_membership.id,
    null, key, before_payload, after_payload
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'manage_room_member', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_room_cards()
  RETURNS TABLE (
    room_id              uuid,
    room_slug            text,
    room_title           text,
    room_description     text,
    membership_role      text,
    season_id            uuid,
    season_title         text,
    season_status        text,
    season_starts_at     timestamp with time zone,
    season_ends_at       timestamp with time zone,
    publication_id       uuid,
    publication_status   text,
    opens_at             timestamp with time zone,
    closes_at            timestamp with time zone,
    challenge_title      text,
    challenge_subtitle   text,
    challenge_mode       text,
    challenge_max_score  integer,
    question_count       bigint,
    competitive_playable boolean,
    member_count         bigint,
    member_previews      jsonb,
    current_flash_points bigint,
    current_position     bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with current_player as (
    select private.current_player_id() as player_id
  ), accessible_rooms as (
    select r.id, r.slug, r.title, r.description, m.role
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    cross join current_player viewer
    where m.player_id = viewer.player_id
      and m.status = 'active'
      and r.status = 'active'
  )
  select
    r.id,
    r.slug,
    r.title,
    r.description,
    r.role,
    season.id,
    season.title,
    season.status,
    season.starts_at,
    season.ends_at,
    publication.id,
    publication.status,
    publication.opens_at,
    publication.closes_at,
    publication.challenge_title,
    publication.challenge_subtitle,
    publication.challenge_mode,
    publication.challenge_max_score,
    publication.question_count,
    publication.competitive_playable,
    (select count(*)::bigint
       from public.room_memberships active_members
      where active_members.room_id = r.id and active_members.status = 'active'),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.display_name,
          'avatarPath', p.avatar_path,
          'role', active_members.role
        ) order by active_members.joined_at, p.id
      )
      from public.room_memberships active_members
      join public.players p on p.id = active_members.player_id
      where active_members.room_id = r.id
        and active_members.status = 'active'
        and p.status = 'active'
    ), '[]'::jsonb),
    coalesce((
      select sum(entries.amount)::bigint
      from private.flash_point_entries entries
      where entries.player_id = (select player_id from current_player)
        and entries.season_id = season.id
    ), 0::bigint),
    (
      select ranking."position"
      from public.get_season_ranking(season.id) ranking
      where ranking.player_id = (select player_id from current_player)
    )
  from accessible_rooms r
  left join lateral (
    select s.id, s.title, s.status, s.starts_at, s.ends_at
    from public.seasons s
    where s.room_id = r.id
      and s.status = 'active'
    order by s.starts_at desc, s.id
    limit 1
  ) season on true
  left join lateral (
    select
      sc.id,
      sc.status,
      sc.opens_at,
      sc.closes_at,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      (
        select count(*)::bigint
        from private.challenge_items items
        where items.challenge_version_id = cv.id
      ) as question_count,
      (
        select count(*) between 2 and 20 and bool_and(private.is_supported_flash_question(q.id))
        from private.challenge_items items
        join private.question_versions q on q.id = items.question_version_id
        where items.challenge_version_id = cv.id
      ) as competitive_playable
    from public.scheduled_challenges sc
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    where sc.season_id = season.id
      and private.publication_is_effectively_open(
        sc.status, season.status, season.starts_at, season.ends_at,
        sc.opens_at, sc.closes_at, statement_timestamp()
      )
      and cv.status = 'published'
    order by sc.number
    limit 1
  ) publication on true
  order by r.title, r.id
$function$;

CREATE OR REPLACE FUNCTION public.manage_room_member (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.manage_room_member_command(input);
$function$;

REVOKE ALL ON FUNCTION "private"."manage_room_member_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."manage_room_member_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "public"."manage_room_member"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."manage_room_member"(jsonb) TO "authenticated", "postgres";
