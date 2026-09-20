-- Private beta portal read boundary. A superadmin is a platform assignment,
-- not a room membership and not a client-editable Auth claim.
create function public.get_superadmin_portal_context()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  operator_payload jsonb;
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'playerId', player.id,
    'displayName', player.display_name
  )
  into operator_payload
  from public.players player
  where player.id = actor and player.status = 'active';

  if operator_payload is null then
    raise exception 'player_unavailable' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'operator', operator_payload,
    'rooms', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'roomId', room.id,
          'slug', room.slug,
          'title', room.title,
          'timeZone', room.time_zone,
          'seasons', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'seasonId', season.id,
                'title', season.title,
                'status', season.status,
                'startsAt', season.starts_at,
                'endsAt', season.ends_at
              ) order by season.starts_at desc, season.id
            )
            from public.seasons season
            where season.room_id = room.id
          ), '[]'::jsonb),
          'status', room.status
        ) order by room.title, room.id
      )
      from public.rooms room
      where room.status = 'active'
    ), '[]'::jsonb)
  );
end;
$$;

alter function public.get_superadmin_portal_context() owner to postgres;
revoke all on function public.get_superadmin_portal_context() from public, anon, service_role;
grant execute on function public.get_superadmin_portal_context() to authenticated;

-- Dashboard read boundary. This deliberately returns summaries only; editorial
-- payloads, solutions, the full question library, and calendar rows stay behind
-- their dedicated queries.
create function public.get_superadmin_dashboard_context()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  operator_payload jsonb;
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'playerId', player.id,
    'displayName', player.display_name
  )
  into operator_payload
  from public.players player
  where player.id = actor and player.status = 'active';

  if operator_payload is null then
    raise exception 'player_unavailable' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'operator', operator_payload,
    'metrics', jsonb_build_object(
      'activeRooms', (
        select count(*)
        from public.rooms room
        where room.status = 'active'
      ),
      'activeSeasons', (
        select count(*)
        from public.seasons season
        join public.rooms room on room.id = season.room_id
        where room.status = 'active' and season.status = 'active'
      ),
      'pendingSeasons', (
        select count(*)
        from public.seasons season
        join public.rooms room on room.id = season.room_id
        where room.status = 'active' and season.status in ('draft', 'scheduled')
      ),
      'editorialDrafts', (
        select count(*)
        from private.challenge_versions version
        where version.mode = 'flash' and version.status = 'draft'
      ),
      'upcomingChallenges', (
        select count(*)
        from public.scheduled_challenges schedule
        join public.seasons season on season.id = schedule.season_id
        join public.rooms room on room.id = season.room_id
        join private.challenge_versions version on version.id = schedule.challenge_version_id
        where room.status = 'active'
          and season.status = 'active'
          and version.mode = 'flash'
          and version.status = 'published'
          and schedule.status in ('scheduled', 'open')
          and schedule.closes_at >= now()
      )
    ),
    'rooms', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'roomId', room.id,
          'slug', room.slug,
          'title', room.title,
          'timeZone', room.time_zone,
          'seasonCount', (
            select count(*)
            from public.seasons season_count
            where season_count.room_id = room.id
          ),
          'activeSeason', (
            select jsonb_build_object(
              'title', season.title,
              'startsAt', season.starts_at,
              'endsAt', season.ends_at
            )
            from public.seasons season
            where season.room_id = room.id and season.status = 'active'
            order by season.starts_at desc, season.id
            limit 1
          )
        ) order by room.title, room.id
      )
      from public.rooms room
      where room.status = 'active'
    ), '[]'::jsonb),
    'upcomingChallenges', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'scheduledChallengeId', upcoming.scheduled_challenge_id,
          'roomId', upcoming.room_id,
          'roomTitle', upcoming.room_title,
          'seasonId', upcoming.season_id,
          'seasonTitle', upcoming.season_title,
          'challengeVersionId', upcoming.challenge_version_id,
          'challengeTitle', upcoming.challenge_title,
          'number', upcoming.challenge_number,
          'status', upcoming.challenge_status,
          'opensAt', upcoming.opens_at,
          'closesAt', upcoming.closes_at,
          'timeZone', upcoming.time_zone
        ) order by upcoming.opens_at, upcoming.scheduled_challenge_id
      )
      from (
        select
          schedule.id as scheduled_challenge_id,
          room.id as room_id,
          room.title as room_title,
          season.id as season_id,
          season.title as season_title,
          version.id as challenge_version_id,
          version.title as challenge_title,
          schedule.number as challenge_number,
          schedule.status as challenge_status,
          schedule.opens_at,
          schedule.closes_at,
          room.time_zone
        from public.scheduled_challenges schedule
        join public.seasons season on season.id = schedule.season_id
        join public.rooms room on room.id = season.room_id
        join private.challenge_versions version on version.id = schedule.challenge_version_id
        where room.status = 'active'
          and season.status = 'active'
          and version.mode = 'flash'
          and version.status = 'published'
          and schedule.status in ('scheduled', 'open')
          and schedule.closes_at >= now()
        order by schedule.opens_at, schedule.id
        limit 5
      ) upcoming
    ), '[]'::jsonb)
  );
end;
$$;

alter function public.get_superadmin_dashboard_context() owner to postgres;
revoke all on function public.get_superadmin_dashboard_context() from public, anon, service_role;
grant execute on function public.get_superadmin_dashboard_context() to authenticated;
