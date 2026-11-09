-- Opt-in Queens timeout credit for new Contrarreloj challenge versions.

set local check_function_bodies = off;

create function private.is_valid_time_trial_config(config jsonb, question_type text) returns boolean
language sql immutable set search_path = '' as $$
  select config = '{}'::jsonb
    or (config = '{"queensTimeoutPartialCredit":true}'::jsonb and question_type = 'queens')
$$;
alter function private.is_valid_time_trial_config(jsonb,text) owner to postgres;
revoke all on function private.is_valid_time_trial_config(jsonb,text) from public,anon,authenticated,service_role;

create or replace function private.assert_time_trial_content(target_version uuid) returns void
language plpgsql volatile set search_path = '' as $$
declare version private.challenge_versions%rowtype;
begin
  select * into version from private.challenge_versions where id = target_version;
  if version.mode <> 'time-trial' then return; end if;
  if version.config_schema_version <> 1
    or version.global_time_limit_ms is null or version.global_time_limit_ms <= 0
    or version.global_time_limit_ms % 1000 <> 0
    or (select count(*) from private.challenge_items where challenge_version_id = target_version) not between 2 and 20
    or (select coalesce(sum(points),0) from private.challenge_items where challenge_version_id = target_version) <> 100
    or exists (
      select 1 from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
      where i.challenge_version_id = target_version and (
        i.points <= 0 or i.config_schema_version <> 1 or i.mode_config <> '{}'::jsonb
        or not private.is_valid_time_trial_config(version.mode_config, q.type)
        or q.type not in ('queens','connect-pairs') or q.payload_schema_version <> 1
        or not private.is_supported_time_trial_question(q.id)
      )
    ) or (select count(distinct q.type) from private.challenge_items i
      join private.question_versions q on q.id = i.question_version_id
      where i.challenge_version_id = target_version) <> 1
    or (select max(position) from private.challenge_items where challenge_version_id = target_version)
      <> (select count(*) from private.challenge_items where challenge_version_id = target_version) then
    raise exception 'invalid_time_trial_content' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.validate_flash_editorial_document(document jsonb) returns void
language plpgsql volatile set search_path = '' as $$
declare
  challenge jsonb;
  question jsonb;
  question_slug text;
  trial_format text;
  question_format text;
  seen_slugs text[] := array[]::text[];
  question_index integer;
  question_points numeric;
  total_points integer := 0;
  seen_question_versions text[] := array[]::text[];
  seen_level_ids text[] := array[]::text[];
begin
  if document is null or jsonb_typeof(document) is distinct from 'object'
    or not document ?& array['challenge', 'questions']
    or exists (
      select 1 from jsonb_object_keys(document) key_name
      where key_name <> all(array['challenge', 'questions'])
    ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  challenge := document->'challenge';
  if jsonb_typeof(challenge) is distinct from 'object'
    or not challenge ?& array['slug', 'title', 'subtitle', 'description', 'mode', 'configSchemaVersion', 'modeConfig']
    or exists (
      select 1 from jsonb_object_keys(challenge) key_name
      where key_name <> all(array['slug', 'title', 'subtitle', 'description', 'mode', 'configSchemaVersion', 'modeConfig', 'globalTimeLimitMs'])
    )
    or jsonb_typeof(challenge->'slug') is distinct from 'string'
    or char_length(btrim(challenge->>'slug')) not between 1 and 120
    or jsonb_typeof(challenge->'title') is distinct from 'string'
    or char_length(btrim(challenge->>'title')) not between 1 and 200
    or jsonb_typeof(challenge->'subtitle') is distinct from 'string'
    or char_length(challenge->>'subtitle') > 300
    or jsonb_typeof(challenge->'description') is distinct from 'string'
    or char_length(challenge->>'description') > 2000
    or challenge->>'mode' not in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
    or challenge->'configSchemaVersion' <> '1'::jsonb
    or jsonb_typeof(challenge->'modeConfig') is distinct from 'object'
    or (challenge->>'mode' in ('alphabet', 'time-trial') and (
      jsonb_typeof(challenge->'globalTimeLimitMs') is distinct from 'number'
      or (challenge->>'globalTimeLimitMs')::numeric <> trunc((challenge->>'globalTimeLimitMs')::numeric)
      or (challenge->>'globalTimeLimitMs')::integer <= 0
    ))
    or (challenge->>'mode' not in ('alphabet', 'time-trial') and challenge ? 'globalTimeLimitMs')
    or (challenge->>'mode' = 'survival' and (
      (select count(*) from jsonb_object_keys(challenge->'modeConfig')) <> 1
      or jsonb_typeof(challenge->'modeConfig'->'lives') is distinct from 'number'
      or (challenge->'modeConfig'->>'lives')::numeric <> trunc((challenge->'modeConfig'->>'lives')::numeric)
      or (challenge->'modeConfig'->>'lives')::integer not between 1 and 20
    ))
    or (challenge->>'mode' = 'pyramid' and challenge->'modeConfig' <> '{}'::jsonb)
    or (challenge->>'mode' = 'time-trial'
      and not private.is_valid_time_trial_config(challenge->'modeConfig', 'queens')) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  if jsonb_typeof(document->'questions') is distinct from 'array'
    or (challenge->>'mode' = 'pyramid' and jsonb_array_length(document->'questions') <> 7)
    or (challenge->>'mode' <> 'pyramid' and jsonb_array_length(document->'questions') not between 2 and 20) then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;

  if challenge->>'mode' = 'survival'
    and (challenge->'modeConfig'->>'lives')::integer > jsonb_array_length(document->'questions') then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  if challenge->>'mode' = 'time-trial' and (challenge->>'globalTimeLimitMs')::integer % 1000 <> 0 then
    raise exception 'invalid_content' using errcode = '22023';
  end if;
  for question, question_index in
    select value, ordinality::integer
    from jsonb_array_elements(document->'questions') with ordinality
  loop
    if challenge->>'mode' = 'time-trial' then
      if question->>'source' = 'library' then
        select q.type into question_format from private.question_versions q
          where q.id = case when question->>'questionVersionId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then (question->>'questionVersionId')::uuid else null end and q.status = 'published';
      else
        question_format := question->>'type';
      end if;
      if question_format is null or question_format not in ('queens','connect-pairs')
        or not private.is_valid_time_trial_config(challenge->'modeConfig', question_format)
        or (trial_format is not null and trial_format <> question_format) then
        raise exception 'unsupported_question' using errcode = '22023';
      end if;
      trial_format := question_format;
    end if;
    if challenge->>'mode' = 'pyramid' then
      if not private.is_valid_pyramid_level_config(question->'modeConfig') then
        raise exception 'invalid_content' using errcode = '22023';
      end if;
      if question->'modeConfig'->>'levelId' = any(seen_level_ids) then
        raise exception 'invalid_content' using errcode = '22023';
      end if;
      seen_level_ids := seen_level_ids || (question->'modeConfig'->>'levelId');
    end if;
    if jsonb_typeof(question) = 'object' and question->>'source' = 'library' then
      if exists (
          select 1 from jsonb_object_keys(question) key_name
          where key_name <> all(array['source', 'questionVersionId', 'points', 'modeConfig', 'challengeItemId'])
        )
        or not question ?& array['source', 'questionVersionId', 'points', 'modeConfig']
        or jsonb_typeof(question->'questionVersionId') is distinct from 'string'
        or question->>'questionVersionId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or jsonb_typeof(question->'points') is distinct from 'number'
        or (question->>'points')::numeric <> trunc((question->>'points')::numeric)
        or (question->>'points')::integer <= 0
        or (question->>'points')::integer > 100
        or jsonb_typeof(question->'modeConfig') is distinct from 'object'
        or (question ? 'challengeItemId' and (
          jsonb_typeof(question->'challengeItemId') is distinct from 'string'
          or question->>'challengeItemId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ))
        or question->>'questionVersionId' = any(seen_question_versions) then
        raise exception 'invalid_question_reference' using errcode = '22023';
      end if;
      if challenge->>'mode' = 'time-trial' and not exists (
        select 1 from private.question_versions q where q.id = (question->>'questionVersionId')::uuid
          and q.status = 'published' and private.is_supported_time_trial_question(q.id)
      ) then raise exception 'unsupported_question' using errcode = '22023'; end if;
      seen_question_versions := seen_question_versions || (question->>'questionVersionId');
      if challenge->>'mode' in ('survival', 'pyramid') and not exists (
        select 1 from private.question_versions supported
        where supported.id = (question->>'questionVersionId')::uuid
          and private.is_supported_flash_question(supported.id)
      ) then
        raise exception 'unsupported_question' using errcode = '22023';
      end if;
      total_points := total_points + (question->>'points')::integer;
      continue;
    end if;
    if jsonb_typeof(question) is distinct from 'object'
      or not question ?& array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload']
      or exists (
        select 1 from jsonb_object_keys(question) key_name
        where key_name <> all(array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload', 'modeConfig', 'difficulty'])
      )
      or (challenge->>'mode' = 'pyramid' and not private.is_valid_pyramid_level_config(question->'modeConfig'))
      or (challenge->>'mode' not in ('pyramid', 'narrative') and question ? 'modeConfig') then
      raise exception 'invalid_content' using errcode = '22023';
    end if;

    if challenge->>'mode' = 'time-trial' and question->>'type' not in ('queens','connect-pairs') then
      raise exception 'unsupported_question' using errcode = '22023';
    end if;
    perform private.validate_flash_question_document(question - 'points' - 'modeConfig');
    if challenge->>'mode' = 'time-trial' and question->>'type' = 'connect-pairs'
      and not private.connect_pairs_answer_valid(question->'publicPayload',
        jsonb_build_object('paths',question->'solutionPayload'->'paths')) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    question_slug := btrim(question->>'slug');
    if question_slug = any(seen_slugs) then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    if jsonb_typeof(question->'points') is distinct from 'number' then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    question_points := (question->>'points')::numeric;
    if question_points <> trunc(question_points)
      or question_points <= 0
      or question_points > 100 then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    total_points := total_points + question_points::integer;
    seen_slugs := seen_slugs || question_slug;
  end loop;
  if challenge->>'mode' = 'alphabet' then
    if exists (
      select 1 from jsonb_array_elements(document->'questions') question_row
      where question_row->>'source' <> 'library'
        or jsonb_typeof(question_row->'modeConfig') is distinct from 'object'
        or jsonb_typeof(question_row->'modeConfig'->'letter') is distinct from 'string'
        or char_length(question_row->'modeConfig'->>'letter') = 0
        or char_length(question_row->'modeConfig'->>'letter') > 4
        or question_row->'modeConfig'->>'letter' !~ '^[[:alpha:]]$'
        or not exists (
          select 1 from private.question_versions version
          where version.id = (question_row->>'questionVersionId')::uuid
            and version.status = 'published' and version.type = 'short-text'
        )
    ) then
      raise exception 'invalid_alphabet_item' using errcode = '22023';
    end if;
    if exists (
      select 1 from (
        select lower(question_row->'modeConfig'->>'letter') as letter
        from jsonb_array_elements(document->'questions') question_row
      ) letters group by letter having count(*) > 1
    ) then
      raise exception 'duplicate_alphabet_letter' using errcode = '22023';
    end if;
  end if;
  if total_points <> 100 then
    raise exception 'points_total_invalid' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.get_my_room_cards()
returns table (
  room_id              uuid,
  room_slug            text,
  room_title           text,
  room_description     text,
  membership_role      text,
  season_id            uuid,
  season_title        text,
  season_status        text,
  season_starts_at    timestamptz,
  season_ends_at      timestamptz,
  publication_id       uuid,
  publication_status   text,
  opens_at             timestamptz,
  closes_at            timestamptz,
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
language sql stable security definer set search_path = '' as $$
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
        select (count(*) between 2 and 20 and cv.mode in ('flash', 'alphabet', 'survival', 'narrative', 'time-trial')
            or count(*) = 7 and cv.mode = 'pyramid')
          and bool_and(private.is_supported_flash_question(q.id))
          and (cv.mode = 'time-trial' and cv.global_time_limit_ms > 0 and bool_and(
              private.is_valid_time_trial_config(cv.mode_config, q.type)
              and private.is_supported_time_trial_question(q.id)) and count(distinct q.type) = 1
            or cv.mode = 'flash' and cv.mode_config = '{}'::jsonb
            or cv.mode = 'alphabet' and cv.mode_config = '{}'::jsonb
              and bool_and(jsonb_typeof(items.mode_config->'letter') = 'string')
            or cv.mode = 'survival'
              and jsonb_typeof(cv.mode_config->'lives') = 'number'
              and (cv.mode_config->>'lives')::integer between 1 and count(*)
              and (select count(*) from jsonb_object_keys(cv.mode_config)) = 1
            or cv.mode = 'pyramid' and cv.mode_config = '{}'::jsonb
              and bool_and(private.is_valid_pyramid_level_config(items.mode_config))
              and count(distinct items.mode_config->>'levelId') = 7
            or cv.mode = 'narrative'
              and jsonb_typeof(cv.mode_config->'prologue') = 'object'
              and jsonb_typeof(cv.mode_config->'beats') = 'array')
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
      and cv.status in ('published', 'archived')
    order by sc.number
    limit 1
  ) publication on true
  order by r.title, r.id
$$;

create or replace function public.get_room_introduction(target_room_slug text, target_publication_id uuid)
returns table (
  room_id             uuid,
  room_slug           text,
  room_title          text,
  membership_role     text,
  publication_id      uuid,
  publication_status  text,
  opens_at            timestamptz,
  closes_at           timestamptz,
  challenge_title     text,
  challenge_subtitle  text,
  challenge_mode      text,
  challenge_max_score integer,
  question_count      bigint,
  competitive_playable boolean,
  availability_status  text,
  can_start            boolean
)
language sql stable security definer set search_path = '' as $$
  select
    room.id,
    room.slug,
    room.title,
    membership.role,
    schedule.id,
    schedule.status,
    schedule.opens_at,
    schedule.closes_at,
    version.title,
    version.subtitle,
    version.mode,
    version.max_score,
    (select count(*)::bigint from private.challenge_items item where item.challenge_version_id = version.id),
    (select (count(*) between 2 and 20 and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'time-trial')
          or count(*) = 7 and version.mode = 'pyramid')
        and bool_and(private.is_supported_flash_question(question.id))
        and (version.mode = 'time-trial' and version.global_time_limit_ms > 0 and bool_and(
            private.is_valid_time_trial_config(version.mode_config, question.type)
            and private.is_supported_time_trial_question(question.id)) and count(distinct question.type) = 1
        or version.mode = 'flash' and version.mode_config = '{}'::jsonb
          or version.mode = 'alphabet' and version.mode_config = '{}'::jsonb
            and bool_and(jsonb_typeof(item.mode_config->'letter') = 'string')
          or version.mode = 'survival'
            and jsonb_typeof(version.mode_config->'lives') = 'number'
            and (version.mode_config->>'lives')::integer between 1 and count(*)
            and (select count(*) from jsonb_object_keys(version.mode_config)) = 1
          or version.mode = 'pyramid' and version.mode_config = '{}'::jsonb
            and bool_and(private.is_valid_pyramid_level_config(item.mode_config))
            and count(distinct item.mode_config->>'levelId') = 7
          or version.mode = 'narrative'
            and jsonb_typeof(version.mode_config->'prologue') = 'object'
            and jsonb_typeof(version.mode_config->'beats') = 'array')
       from private.challenge_items item
       join private.question_versions question on question.id = item.question_version_id
      where item.challenge_version_id = version.id),
    private.publication_effective_status(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    membership.role <> 'spectator' and private.publication_is_effectively_open(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    )
  from public.rooms room
  join public.room_memberships membership on membership.room_id = room.id
  join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
  join public.scheduled_challenges schedule on schedule.season_id = season.id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  where room.slug = target_room_slug
    and schedule.id = target_publication_id
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and version.status in ('published', 'archived')
  order by season.starts_at desc, schedule.number
$$;

create or replace function public.get_my_competitive_challenge(target_room_slug text, target_publication_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare challenge_mode text; challenge_rows jsonb;
begin
  select version.mode into challenge_mode
  from public.scheduled_challenges publication
  join public.seasons season on season.id = publication.season_id
  join public.rooms room on room.id = season.room_id
  join private.challenge_versions version on version.id = publication.challenge_version_id
  where publication.id = target_publication_id and room.slug = target_room_slug;

  case challenge_mode
    when 'time-trial' then
      select jsonb_agg(to_jsonb(row) || jsonb_build_object(
        'queens_timeout_partial_credit', version.mode_config = '{"queensTimeoutPartialCredit":true}'::jsonb
      ) order by row.item_position) into challenge_rows
      from public.get_my_time_trial_challenge(target_room_slug, target_publication_id) row
      join private.challenge_versions version on version.id = row.challenge_version_id;
    when 'flash' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_flash_challenge(target_room_slug, target_publication_id) row;
    when 'alphabet' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_alphabet_challenge(target_room_slug, target_publication_id) row;
    when 'survival' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_survival_challenge(target_room_slug, target_publication_id) row;
    when 'pyramid' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_pyramid_challenge(target_room_slug, target_publication_id) row;
    when 'narrative' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_narrative_challenge(target_room_slug, target_publication_id) row;
    else return null;
  end case;

  -- Never disclose even the mode for an absent/inaccessible projection.
  if challenge_rows is null then return null; end if;
  return jsonb_build_object('mode', challenge_mode, 'rows', challenge_rows);
end;
$$;

create or replace function public.get_room_calendar(target_room_slug text)
returns table (
  room_id uuid,
  room_slug text,
  room_title text,
  time_zone text,
  membership_role text,
  season_id uuid,
  season_title text,
  season_status text,
  publication_id uuid,
  publication_number integer,
  publication_status text,
  availability_status text,
  opens_at timestamptz,
  closes_at timestamptz,
  challenge_title text,
  challenge_subtitle text,
  challenge_mode text,
  question_count bigint,
  own_attempt_status text,
  can_start boolean,
  can_continue boolean
)
language sql stable security definer set search_path = '' as $$
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
      or version.mode = 'time-trial'
        and version.global_time_limit_ms > 0
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
      (count(*) between 2 and 20 and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'time-trial')
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
          or version.mode = 'time-trial'
            and private.is_valid_time_trial_config(version.mode_config, question.type)
            and version.global_time_limit_ms > 0
            and private.is_supported_time_trial_question(question.id)
            and item.mode_config = '{}'::jsonb
          or version.mode not in ('pyramid', 'narrative', 'alphabet', 'time-trial')
            and item.mode_config = '{}'::jsonb
        )), false)
        and (version.mode <> 'pyramid' or count(distinct item.mode_config->>'levelId') = 7)
        and (version.mode <> 'time-trial' or count(distinct question.type) = 1)
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
    and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
    and version.config_schema_version = 1
    and version.max_score = 100
  order by schedule.number
$$;

create or replace function private.guard_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'Create a draft before publishing'; end if;
    return new;
  end if;
  if old.status <> 'draft' then
    if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'archived'
      and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
      return new;
    end if;
    raise exception 'Published content is immutable; create another version';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.id <> old.id then raise exception 'Version identity is immutable'; end if;
  if new.status = 'archived' then raise exception 'Publish before archiving a version'; end if;
  if new.status = 'published' then
    if tg_table_name = 'question_versions' then
      if not exists (select 1 from private.question_version_solutions where question_version_id = new.id) then
        raise exception 'A published question requires a solution';
      end if;
    else
      perform 1 from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
        where i.challenge_version_id = new.id for share of q;
      if (select coalesce(sum(points), 0) from private.challenge_items where challenge_version_id = new.id) <> 100 then
        raise exception 'Challenge items must sum to 100 points';
      end if;
      if new.mode = 'time-trial' then
        -- The content assertion reads the saved draft by ID.
        if new.mode is distinct from old.mode or new.mode_config is distinct from old.mode_config then
          raise exception 'invalid_time_trial_content' using errcode = '22023';
        end if;
        perform private.assert_time_trial_content(new.id);
      end if;
      if exists (select 1 from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
        where i.challenge_version_id = new.id and q.status <> 'published') then
        raise exception 'Publish every question before its challenge';
      end if;
    end if;
    new.published_at := statement_timestamp();
  end if;
  return new;
end;
$$;

create or replace function private.guard_answer() returns trigger
language plpgsql set search_path = '' as $$
declare
  a public.attempts%rowtype;
  r private.answer_receipts%rowtype;
  item_points integer;
  challenge_mode text;
  challenge_config jsonb;
  question_version uuid;
  public_payload jsonb;
  solution jsonb;
  correct_placements integer;
  required_placements integer;
begin
  select * into a from public.attempts where id = new.attempt_id for update;
  if a.status is distinct from 'in_progress' then raise exception 'Attempt is not in progress'; end if;
  select * into r from private.answer_receipts where id = new.receipt_id;
  if not found or (r.attempt_id, r.challenge_item_id, r.challenge_version_id) is distinct from
    (new.attempt_id, new.challenge_item_id, new.challenge_version_id) then
    raise exception 'A final answer requires its immutable receipt';
  end if;
  new.presented_at := r.presented_at;
  new.submitted_at := r.effective_submitted_at;
  new.time_used_ms := r.time_used_ms;
  new.answer := r.answer;
  -- Late timeout finalization uses the previously recorded reception, not evaluation time.
  if new.presented_at < a.started_at or new.presented_at > a.deadline_at
    or (new.submitted_at is not null and new.submitted_at > a.deadline_at) then
    raise exception 'Answer timestamps outside attempt deadline';
  end if;
  if exists (select 1 from public.scheduled_challenges where id = a.scheduled_challenge_id and status = 'cancelled') then
    raise exception 'Publication cancelled';
  end if;
  select i.points, cv.mode, cv.mode_config, i.question_version_id
    into item_points, challenge_mode, challenge_config, question_version
  from private.challenge_items i
  join private.challenge_versions cv on cv.id = i.challenge_version_id
  where i.id = new.challenge_item_id;
  if challenge_mode = 'time-trial'
    and (new.status = 'partial' or new.points <> case when new.status = 'correct' then item_points else 0 end
      or (new.status = 'correct' and (r.timed_out or r.received_at >= a.deadline_at))) then
    raise exception 'Invalid Contrarreloj score';
  end if;
  if challenge_mode = 'time-trial' and challenge_config = '{"queensTimeoutPartialCredit":true}'::jsonb
    and new.status = 'unanswered' and r.timed_out and r.received_at >= a.deadline_at
    and r.effective_submitted_at = a.deadline_at
    and (r.answer is null or r.answer = 'null'::jsonb) then
    new.review_state := private.attempt_review_state(a.id, new.challenge_item_id);
    if new.review_state->>'type' = 'queens' then
      select q.public_payload, s.solution_payload->'solution' into public_payload, solution
      from private.question_versions q
      join private.question_version_solutions s on s.question_version_id = q.id
      where q.id = question_version;
      required_placements := (public_payload->'grid'->>'rows')::integer
        - jsonb_array_length(public_payload->'prefilledQueens');
      select count(distinct cell.value)::integer into correct_placements
      from jsonb_array_elements(new.review_state->'queens') cell(value)
      where solution @> jsonb_build_array(cell.value)
        and not (public_payload->'prefilledQueens' @> jsonb_build_array(cell.value));
      if required_placements > 0 then
        new.points := least(item_points - 1, item_points * correct_placements / required_placements);
      end if;
      if new.points > 0 then new.status := 'partial'; end if;
    end if;
  end if;
  if new.points > item_points then raise exception 'Points exceed item allocation'; end if;
  return new;
end;
$$;

create or replace view private.effective_results with (security_invoker = true) as
select a.id as attempt_id, a.player_id, a.scheduled_challenge_id, sc.season_id,
  s.room_id, a.started_at, points.flash_points,
  case when cv.mode = 'time-trial' then coalesce((trial.progress->>'lastCorrectElapsedMs')::bigint,0) else duration.duration_ms end as duration_ms,
  cv.mode as challenge_mode, (trial.progress->>'solvedCount')::integer as solved_count,
  (trial.progress->>'lastCorrectElapsedMs')::bigint as last_correct_elapsed_ms,
  case when cv.mode = 'time-trial' and cv.mode_config = '{"queensTimeoutPartialCredit":true}'::jsonb
    then (trial.progress->>'points')::integer end as time_trial_tiebreak_points
from public.attempts a
join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
join public.seasons s on s.id = sc.season_id
join private.challenge_versions cv on cv.id = a.challenge_version_id
cross join lateral (select case when cv.mode = 'time-trial' then private.time_trial_progress(a.id) end as progress) trial
join lateral (
  select sum(e.amount)::bigint as flash_points
  from private.flash_point_entries e where e.attempt_id = a.id
  having bool_or(e.entry_type = 'accreditation')
) points on true
cross join lateral (
  select coalesce(sum(aa.time_used_ms), 0)::bigint as duration_ms
  from private.attempt_answers aa where aa.attempt_id = a.id
) duration
where a.kind = 'competitive' and a.status = 'completed' and sc.status <> 'cancelled';

create or replace view private.ranked_challenge_results with (security_invoker = true) as
select e.attempt_id, e.player_id, e.scheduled_challenge_id, e.season_id, e.room_id,
  e.started_at, e.flash_points, e.duration_ms, e.challenge_mode, e.solved_count, e.last_correct_elapsed_ms,
  rank() over (partition by scheduled_challenge_id order by
  case when challenge_mode = 'time-trial' then solved_count else flash_points end desc,
  time_trial_tiebreak_points desc nulls last,
  case when challenge_mode = 'time-trial' then last_correct_elapsed_ms else duration_ms end asc nulls last,
  case when challenge_mode <> 'time-trial' then started_at end asc
) as position from private.effective_results e;

create or replace function private.handle_attempt_evaluation(
  input jsonb,
  target_attempt public.attempts,
  target_version private.challenge_versions
) returns table(updated_attempt public.attempts, operation_result jsonb, clear_progress boolean)
language plpgsql volatile security invoker set search_path = '' as $$
declare
  a public.attempts%rowtype := target_attempt;
  cv private.challenge_versions%rowtype := target_version;
  key text := input->>'idempotencyKey';
  receipt private.answer_receipts%rowtype;
  snapshot jsonb;
  saved private.attempt_answers%rowtype;
  result jsonb;
begin
  clear_progress := false;
  select * into receipt from private.answer_receipts where id = (input->>'receiptId')::uuid and attempt_id = a.id;
  if not found then raise exception 'receipt_not_found' using errcode = '55000'; end if;
  if exists (select 1 from private.attempt_answers where receipt_id = receipt.id) then
    raise exception 'already_evaluated' using errcode = '55000';
  end if;
  if receipt.answer is null or receipt.answer = 'null'::jsonb then
    snapshot := private.attempt_review_state(a.id, receipt.challenge_item_id);
  end if;
  -- Only the trusted evaluator may call this wrapper. No browser route is granted EXECUTE.
  insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id, receipt_id,
    status, answer, result_details, review_state, points, presented_at, submitted_at, time_used_ms, idempotency_key)
  values(a.id, receipt.challenge_item_id, receipt.challenge_version_id, receipt.id,
    input->>'status', receipt.answer, input->'resultDetails', snapshot,
    case when cv.mode = 'time-trial' then case when input->>'status' = 'correct' then (select allocated.points from private.challenge_items allocated where allocated.id = receipt.challenge_item_id) else 0 end when cv.mode = 'pyramid' and input->>'status' <> 'correct' then 0
      else (input->>'points')::integer end,
    receipt.presented_at, receipt.effective_submitted_at, receipt.time_used_ms, key)
  returning * into saved;
  result := jsonb_build_object('receiptId', receipt.id, 'status', saved.status,
    'points', saved.points) || jsonb_strip_nulls(jsonb_build_object('reviewState', saved.review_state));
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$$;
