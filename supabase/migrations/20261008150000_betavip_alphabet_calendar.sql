-- Make Alphabet publications visible and startable from the member room calendar.
begin;
set local check_function_bodies = off;

create or replace function public.get_room_calendar (
  target_room_slug text
)
  returns table (
    room_id             uuid,
    room_slug           text,
    room_title          text,
    time_zone           text,
    membership_role     text,
    season_id           uuid,
    season_title        text,
    season_status       text,
    publication_id      uuid,
    publication_number  integer,
    publication_status  text,
    availability_status text,
    opens_at            timestamp with time zone,
    closes_at           timestamp with time zone,
    challenge_title     text,
    challenge_subtitle  text,
    challenge_mode      text,
    question_count      bigint,
    own_attempt_status  text,
    can_start           boolean,
    can_continue        boolean
  )
  language sql
  stable
  security definer
  set search_path to ''
  as $function$
  select
    room.id, room.slug, room.title, room.time_zone, membership.role,
    season.id, season.title, season.status,
    schedule.id, schedule.number, schedule.status,
    private.publication_effective_status(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    schedule.opens_at, schedule.closes_at,
    version.title, version.subtitle, version.mode,
    compatibility.question_count,
    attempt.status,
    membership.role <> 'spectator' and (
      version.mode = 'flash' and version.mode_config = '{}'::jsonb
      or version.mode = 'alphabet' and version.mode_config = '{}'::jsonb
      or version.mode = 'survival'
        and (select count(*) from jsonb_object_keys(version.mode_config)) = 1
        and jsonb_typeof(version.mode_config->'lives') = 'number'
        and (version.mode_config->>'lives')::integer between 1 and compatibility.question_count
      or version.mode = 'pyramid' and version.mode_config = '{}'::jsonb
        and compatibility.question_count = 7
      or version.mode = 'narrative'
        and jsonb_typeof(version.mode_config) = 'object'
        and jsonb_typeof(version.mode_config->'prologue') = 'object'
        and jsonb_typeof(version.mode_config->'beats') = 'array'
    ) and compatibility.is_supported and private.publication_is_effectively_open(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    coalesce(attempt.status = 'in_progress', false)
  from public.rooms room
  join public.room_memberships membership on membership.room_id = room.id
  join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
  join public.scheduled_challenges schedule on schedule.season_id = season.id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  join lateral (
    select
      count(*)::bigint as question_count,
      (count(*) between 2 and 20 and version.mode in ('flash', 'alphabet', 'survival', 'narrative')
        or count(*) = 7 and version.mode = 'pyramid')
        and coalesce(bool_and(item.position between 1 and case when version.mode = 'pyramid' then 7 else 20 end), false)
        and coalesce(bool_and(item.points > 0), false)
        and coalesce(bool_and(item.config_schema_version = 1 and (
          version.mode = 'pyramid' and private.is_valid_pyramid_level_config(item.mode_config)
          or version.mode = 'narrative'
            and jsonb_typeof(item.mode_config) = 'object'
            and jsonb_typeof(item.mode_config->'questionSlug') = 'string'
          or version.mode = 'alphabet'
            and jsonb_typeof(item.mode_config->'letter') = 'string'
          or version.mode not in ('pyramid', 'narrative', 'alphabet')
            and item.mode_config = '{}'::jsonb
        )), false)
        and (version.mode <> 'pyramid' or count(distinct item.mode_config->>'levelId') = 7)
        and count(*) filter (where private.is_supported_flash_question(question.id)) = count(*)
        and coalesce(sum(item.points), 0) = 100 as is_supported
    from private.challenge_items item
    join private.question_versions question on question.id = item.question_version_id
    where item.challenge_version_id = version.id
  ) compatibility on true
  left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
    and attempt.player_id = private.current_player_id() and attempt.kind = 'competitive'
  where room.slug = target_room_slug
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and version.status in ('published', 'archived')
    and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid')
    and version.config_schema_version = 1
    and version.max_score = 100
  order by schedule.number
$function$;

commit;
