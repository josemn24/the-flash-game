-- Opt-in timeout credit for Queens and Word Search in Pyramid.
set local check_function_bodies = off;

alter table private.attempt_answers drop constraint attempt_answers_review_state_check;
alter table private.attempt_answers add constraint attempt_answers_review_state_check
  check (review_state is null or (
    jsonb_typeof(review_state) = 'object' and (
      (review_state->>'type' = 'connect-pairs' and jsonb_typeof(review_state->'paths') = 'object') or
      (review_state->>'type' = 'queens' and jsonb_typeof(review_state->'queens') = 'array') or
      (review_state->>'type' = 'word-search' and jsonb_typeof(review_state->'foundWordIds') = 'array')
    )
  ));

create function private.is_valid_pyramid_config(config jsonb, question_types text[]) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(config) = 'object' then not exists (
    select 1 from jsonb_each(config) option
    where option.value <> 'true'::jsonb
      or not coalesce((case option.key
        when 'connectPairsTimeoutPartialCredit' then 'connect-pairs'
        when 'wordSearchTimeoutPartialCredit' then 'word-search'
        when 'queensTimeoutPartialCredit' then 'queens'
      end) = any(question_types), false)
  ) else false end;
$$;
alter function private.is_valid_pyramid_config(jsonb, text[]) owner to postgres;
revoke all on function private.is_valid_pyramid_config(jsonb, text[])
  from public, anon, authenticated, service_role;

create or replace function private.validate_flash_editorial_document(document jsonb) returns void
language plpgsql volatile set search_path = '' as $$
declare
  challenge jsonb;
  question jsonb;
  question_slug text;
  trial_format text;
  pyramid_question_types text[] := '{}';
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
    or (challenge->>'mode' = 'time-trial'
      and not private.is_valid_time_trial_config(challenge->'modeConfig', 'queens')
      and not private.is_valid_time_trial_config(challenge->'modeConfig', 'connect-pairs')) then
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
      if challenge->>'mode' = 'pyramid' then
        select q.type into question_format from private.question_versions q
        where q.id = (question->>'questionVersionId')::uuid;
        pyramid_question_types := array_append(pyramid_question_types, question_format);
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
    if challenge->>'mode' = 'pyramid' then
      pyramid_question_types := array_append(pyramid_question_types, question->>'type');
    end if;
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

  if challenge->>'mode' = 'pyramid'
    and not private.is_valid_pyramid_config(challenge->'modeConfig', pyramid_question_types) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;
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
            or cv.mode = 'pyramid'
              and private.is_valid_pyramid_config(cv.mode_config, array_agg(distinct q.type))
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
          or version.mode = 'pyramid'
            and private.is_valid_pyramid_config(version.mode_config, array_agg(distinct question.type))
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

create or replace function public.get_my_pyramid_challenge(target_room_slug text, target_publication_id uuid)
returns table (
  room_id uuid,
  room_slug text,
  room_title text,
  publication_id uuid,
  publication_status text,
  publication_opens_at timestamptz,
  publication_closes_at timestamptz,
  challenge_id uuid,
  challenge_slug text,
  challenge_version_id uuid,
  challenge_version_number integer,
  challenge_title text,
  challenge_subtitle text,
  challenge_description text,
  challenge_mode text,
  challenge_max_score integer,
  question_count bigint,
  own_attempt_id uuid,
  own_attempt_status text,
  own_attempt_score integer,
  own_attempt_started_at timestamptz,
  own_attempt_completed_at timestamptz,
  own_attempt_deadline_at timestamptz,
  own_attempt_lock_version bigint,
  challenge_item_id uuid,
  item_position integer,
  level_id text,
  level_label text,
  briefing_title text,
  briefing_format text,
  briefing_description text,
  question_version_id uuid,
  question_type text,
  payload_schema_version integer,
  time_limit_ms integer,
  item_points integer
)
language sql stable security definer set search_path = '' as $$
  with viewer as (
    select private.current_player_id() as player_id
  ), authorized_publication as (
    select room.id as room_id, room.slug as room_slug, room.title as room_title,
      schedule.id as publication_id, schedule.status as publication_status,
      schedule.opens_at as publication_opens_at, schedule.closes_at as publication_closes_at,
      definition.id as challenge_id, definition.slug as challenge_slug,
      version.id as challenge_version_id, version.version_number as challenge_version_number,
      version.title as challenge_title, version.subtitle as challenge_subtitle,
      version.description as challenge_description, version.mode as challenge_mode,
      version.max_score as challenge_max_score,
      attempt.id as own_attempt_id, attempt.status as own_attempt_status,
      attempt.score as own_attempt_score, attempt.started_at as own_attempt_started_at,
      attempt.completed_at as own_attempt_completed_at, attempt.deadline_at as own_attempt_deadline_at,
      attempt.lock_version as own_attempt_lock_version
    from public.rooms room
    join public.room_memberships membership on membership.room_id = room.id
    join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
    join public.scheduled_challenges schedule on schedule.season_id = season.id
    join private.challenge_versions version on version.id = schedule.challenge_version_id
    join private.challenge_definitions definition on definition.id = version.challenge_definition_id
    cross join viewer
    left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
      and attempt.player_id = viewer.player_id and attempt.kind = 'competitive'
    where room.slug = target_room_slug and schedule.id = target_publication_id
      and room.status = 'active'
      and membership.player_id = viewer.player_id and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'member')
      and (private.publication_is_effectively_open(
        schedule.status, season.status, season.starts_at, season.ends_at,
        schedule.opens_at, schedule.closes_at, statement_timestamp()) or attempt.id is not null)
      and version.status in ('published', 'archived') and version.mode = 'pyramid'
      and version.config_schema_version = 1 and private.is_valid_pyramid_config(version.mode_config, array(
        select q.type from private.challenge_items item join private.question_versions q on q.id = item.question_version_id
        where item.challenge_version_id = version.id))
      and version.max_score = 100
      and (select count(*) from private.challenge_items item where item.challenge_version_id = version.id) = 7
      and (select count(*) from private.challenge_items item
        where item.challenge_version_id = version.id
          and item.position between 1 and 7 and item.config_schema_version = 1
          and private.is_valid_pyramid_level_config(item.mode_config)
          and private.is_supported_flash_question(item.question_version_id)) = 7
  )
  select publication.room_id, publication.room_slug, publication.room_title,
    publication.publication_id, publication.publication_status,
    publication.publication_opens_at, publication.publication_closes_at,
    publication.challenge_id, publication.challenge_slug, publication.challenge_version_id,
    publication.challenge_version_number, publication.challenge_title,
    publication.challenge_subtitle, publication.challenge_description,
    publication.challenge_mode, publication.challenge_max_score,
    count(item.id) over (partition by publication.challenge_version_id),
    publication.own_attempt_id, publication.own_attempt_status, publication.own_attempt_score,
    publication.own_attempt_started_at, publication.own_attempt_completed_at,
    publication.own_attempt_deadline_at, publication.own_attempt_lock_version,
    item.id, item.position, item.mode_config->>'levelId', item.mode_config->>'label',
    item.mode_config->'briefing'->>'title', item.mode_config->'briefing'->>'format',
    item.mode_config->'briefing'->>'description', question.id, question.type,
    question.payload_schema_version, question.time_limit_ms, item.points
  from authorized_publication publication
  join private.challenge_items item on item.challenge_version_id = publication.challenge_version_id
  join private.question_versions question on question.id = item.question_version_id
  order by item.position
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
        'queens_timeout_partial_credit', version.mode_config = '{"queensTimeoutPartialCredit":true}'::jsonb,
        'connect_pairs_timeout_partial_credit', version.mode_config = '{"connectPairsTimeoutPartialCredit":true}'::jsonb
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
      select jsonb_agg(to_jsonb(row) || jsonb_strip_nulls(jsonb_build_object(
        'connect_pairs_timeout_partial_credit', version.mode_config->'connectPairsTimeoutPartialCredit',
        'word_search_timeout_partial_credit', version.mode_config->'wordSearchTimeoutPartialCredit',
        'queens_timeout_partial_credit', version.mode_config->'queensTimeoutPartialCredit'
      )) order by row.item_position) into challenge_rows
      from public.get_my_pyramid_challenge(target_room_slug, target_publication_id) row
      join private.challenge_versions version on version.id = row.challenge_version_id;
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

create or replace function private.assert_supported_calendar_content(version_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  version_status text;
  version_mode text;
  version_schema integer;
  version_score integer;
  version_config jsonb;
  item_count integer;
  compatible_item_count integer;
  solution_count integer;
  points_total integer;
begin
  select version.status, version.mode, version.config_schema_version, version.max_score, version.mode_config
    into version_status, version_mode, version_schema, version_score, version_config
  from private.challenge_versions version
  where version.id = version_id;

  if not found then
    raise exception 'content_not_found' using errcode = '22023';
  end if;
  if version_status <> 'published' then
    raise exception 'content_not_published' using errcode = '55000';
  end if;
  if version_mode not in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial') then
    raise exception 'unsupported_content' using errcode = '22023';
  end if;

  select count(*)::integer,
    count(*) filter (
      where item.position between 1 and 20
        and item.points > 0
        and item.config_schema_version = 1
        and (version_mode = 'pyramid'
          and private.is_valid_pyramid_level_config(item.mode_config)
          or version_mode = 'narrative'
          and jsonb_typeof(item.mode_config) = 'object'
          and jsonb_typeof(item.mode_config->'questionSlug') = 'string'
          or version_mode = 'alphabet'
          and jsonb_typeof(item.mode_config->'letter') = 'string'
          or version_mode not in ('pyramid', 'narrative', 'alphabet') and item.mode_config = '{}'::jsonb)
        and private.is_supported_flash_question(question.id)
    )::integer,
    coalesce(sum(item.points), 0)::integer
  into item_count, compatible_item_count, points_total
  from private.challenge_items item
  left join private.question_versions question on question.id = item.question_version_id
  where item.challenge_version_id = version_id;

  select count(*)::integer into solution_count
  from private.challenge_items item
  join private.question_version_solutions solution
    on solution.question_version_id = item.question_version_id
  where item.challenge_version_id = version_id;

  if version_schema <> 1 or version_score <> 100
    or (version_mode = 'flash' and version_config <> '{}'::jsonb)
    or (version_mode = 'alphabet' and version_config <> '{}'::jsonb)
    or (version_mode = 'survival' and (
      (select count(*) from jsonb_object_keys(version_config)) <> 1
      or jsonb_typeof(version_config->'lives') is distinct from 'number'
      or (version_config->>'lives')::numeric <> trunc((version_config->>'lives')::numeric)
      or (version_config->>'lives')::integer not between 1 and item_count
    ))
    or (version_mode = 'narrative' and (
      jsonb_typeof(version_config) is distinct from 'object'
      or jsonb_typeof(version_config->'prologue') is distinct from 'object'
      or jsonb_typeof(version_config->'beats') is distinct from 'array'
    ))
    or (version_mode = 'pyramid' and (
      not private.is_valid_pyramid_config(version_config, array(
        select q.type from private.challenge_items item join private.question_versions q on q.id = item.question_version_id
        where item.challenge_version_id = version_id))
      or item_count <> 7
      or (select count(distinct item.mode_config->>'levelId')
        from private.challenge_items item where item.challenge_version_id = version_id) <> 7
      or exists (select 1 from private.challenge_items item
        where item.challenge_version_id = version_id and item.position not between 1 and 7)
    ))
    or (version_mode <> 'pyramid' and item_count not between 2 and 20)
    or compatible_item_count <> item_count
    or solution_count <> item_count
    or points_total <> 100 then
    raise exception 'unsupported_content' using errcode = '22023';
  end if;
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
      or version.mode = 'pyramid'
        and private.is_valid_pyramid_config(version.mode_config, compatibility.question_types)
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
      array_agg(distinct question.type) as question_types,
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

create or replace function private.publish_flash_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text;
  reason_value text;
  expected_updated_at timestamptz;
  challenge_version_id_value uuid;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  challenge_row private.challenge_versions%rowtype;
  definition_row private.challenge_definitions%rowtype;
  item_row private.challenge_items%rowtype;
  question_row private.question_versions%rowtype;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'reason']))
    or input->'idempotencyKey' is null or input->'challengeVersionId' is null
    or input->'expectedUpdatedAt' is null or input->'reason' is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  begin
    challenge_version_id_value := (input->>'challengeVersionId')::uuid;
    expected_updated_at := (input->>'expectedUpdatedAt')::timestamptz;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object(
    'idempotencyKey', key, 'challengeVersionId', challenge_version_id_value,
    'expectedUpdatedAt', expected_updated_at, 'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-editorial-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'publish_flash' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into challenge_row from private.challenge_versions version
  where version.id = challenge_version_id_value for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if challenge_row.status = 'published' then raise exception 'content_already_published' using errcode = '55000'; end if;
  if challenge_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
  if challenge_row.updated_at <> expected_updated_at then raise exception 'content_conflict' using errcode = '40001'; end if;
  select * into definition_row from private.challenge_definitions definition
  where definition.id = challenge_row.challenge_definition_id for update;
  if (select count(*) from private.challenge_items item where item.challenge_version_id = challenge_version_id_value)
    not between 2 and 20 then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;
  if (select coalesce(sum(item.points), 0) from private.challenge_items item where item.challenge_version_id = challenge_version_id_value) <> 100 then
    raise exception 'points_total_invalid' using errcode = '22023';
  end if;
  if challenge_row.mode = 'survival' and (
    (select count(*) from jsonb_object_keys(challenge_row.mode_config)) <> 1
    or jsonb_typeof(challenge_row.mode_config->'lives') is distinct from 'number'
    or (challenge_row.mode_config->>'lives')::numeric <> trunc((challenge_row.mode_config->>'lives')::numeric)
    or (challenge_row.mode_config->>'lives')::integer not between 1 and (
      select count(*)::integer from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value
    )
  ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;
  if challenge_row.mode = 'pyramid' and (
    not private.is_valid_pyramid_config(challenge_row.mode_config, array(
      select q.type from private.challenge_items item join private.question_versions q on q.id = item.question_version_id
      where item.challenge_version_id = challenge_version_id_value))
    or (select count(*) from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value) <> 7
    or (select count(distinct item.mode_config->>'levelId') from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value) <> 7
    or exists (select 1 from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value
        and (item.position not between 1 and 7
          or not private.is_valid_pyramid_level_config(item.mode_config)))
  ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  for item_row in
    select item.* from private.challenge_items item
    where item.challenge_version_id = challenge_version_id_value
    order by item.position for update
  loop
    select * into question_row from private.question_versions version
    where version.id = item_row.question_version_id for update;
    if question_row.status <> 'published' or not exists (
      select 1 from private.question_version_solutions solution
      where solution.question_version_id = question_row.id
    ) then
      raise exception 'question_not_published' using errcode = '55000';
    end if;
    if challenge_row.mode in ('flash', 'survival', 'narrative', 'pyramid', 'time-trial')
      and not private.is_supported_flash_question(question_row.id) then
      raise exception 'unsupported_question' using errcode = '22023';
    end if;
  end loop;
  update private.challenge_versions version
  set status = 'published'
  where version.id = challenge_version_id_value
  returning jsonb_build_object(
    'challengeDefinitionId', definition_row.id,
    'challengeVersionId', version.id,
    'versionNumber', version.version_number,
    'status', version.status,
    'slug', definition_row.slug,
    'title', version.title,
    'subtitle', version.subtitle,
    'description', version.description,
    'mode', version.mode,
    'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = version.id),
    'createdAt', version.created_at,
    'updatedAt', version.updated_at,
    'publishedAt', version.published_at,
    'document', null
  ) into result;
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'publish_flash', 'challenge_version', challenge_version_id_value, reason_value, key,
    jsonb_build_object('status', 'draft', 'slug', definition_row.slug),
    jsonb_build_object(
      'status', 'published',
      'slug', definition_row.slug,
      'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = challenge_version_id_value),
      'maxScore', challenge_row.max_score
    )
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'publish_flash', safe_input, result);
  return result;
end;
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
      elsif new.mode = 'pyramid' and not private.is_valid_pyramid_config(new.mode_config, array(
        select q.type from private.challenge_items item join private.question_versions q on q.id = item.question_version_id
        where item.challenge_version_id = new.id
      )) then
        raise exception 'invalid_content' using errcode = '22023';
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
  checkpoint_solved boolean := false;
  checkpoint_deadline timestamptz;
  checkpoint_saved_at timestamptz;
  pyramid_connect_pairs boolean;
  pyramid_queens boolean;
  pyramid_word_search boolean;
  queens_progress jsonb;
  saved_speed_score integer;
  found_word_ids jsonb;
  total_words integer;
  incorrect_selections integer;
  correct_placements integer;
  required_placements integer;
  connected_pairs integer;
  total_pairs integer;
  covered_cells integer;
  total_cells integer;
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
  select i.points, cv.mode, cv.mode_config, i.question_version_id,
    cv.mode = 'pyramid' and q.type = 'connect-pairs'
      and coalesce(cv.mode_config->'connectPairsTimeoutPartialCredit' = 'true'::jsonb, false),
    cv.mode = 'pyramid' and q.type = 'queens'
      and coalesce(cv.mode_config->'queensTimeoutPartialCredit' = 'true'::jsonb, false),
    cv.mode = 'pyramid' and q.type = 'word-search'
      and coalesce(cv.mode_config->'wordSearchTimeoutPartialCredit' = 'true'::jsonb, false)
    into item_points, challenge_mode, challenge_config, question_version,
      pyramid_connect_pairs, pyramid_queens, pyramid_word_search
  from private.challenge_items i
  join private.challenge_versions cv on cv.id = i.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  where i.id = new.challenge_item_id;
  if (pyramid_queens or pyramid_word_search) and not r.timed_out
    and (r.answer is null or r.answer = 'null'::jsonb) then
    new.status := 'unanswered';
    new.points := 0;
    return new;
  end if;
  if challenge_mode = 'time-trial' then
    checkpoint_deadline := a.deadline_at;
  elsif r.timed_out and (pyramid_connect_pairs or pyramid_queens or pyramid_word_search) then
    select unit.deadline_at into checkpoint_deadline
    from private.attempt_timing_units unit
    where unit.attempt_id = a.id and unit.challenge_item_id = new.challenge_item_id
      and unit.scope = 'level';
    checkpoint_saved_at := (a.progress_payload->>'savedAt')::timestamptz;
  end if;
  if challenge_mode = 'time-trial'
    and (new.status = 'partial' or new.points <> case when new.status = 'correct' then item_points else 0 end
      or (new.status = 'correct' and (r.timed_out or r.received_at >= a.deadline_at))) then
    raise exception 'Invalid Contrarreloj score';
  end if;
  if ((challenge_mode = 'time-trial' and new.status = 'unanswered')
      or pyramid_connect_pairs or pyramid_queens or pyramid_word_search)
    and r.timed_out and r.received_at >= checkpoint_deadline
    and r.effective_submitted_at = checkpoint_deadline
    and (r.answer is null or r.answer = 'null'::jsonb) then
    if challenge_mode = 'pyramid' then
      new.status := 'unanswered';
      new.points := 0;
    end if;
    if pyramid_word_search then
      select coalesce(jsonb_agg(e.matched_target_id order by e.sequence) filter (where e.correct), '[]'::jsonb),
        count(*) filter (where not e.correct)::integer
        into found_word_ids, incorrect_selections
      from private.word_search_selection_events e
      where e.attempt_id = a.id and e.challenge_item_id = new.challenge_item_id
        and e.received_at >= r.presented_at and e.received_at < checkpoint_deadline;
      select jsonb_array_length(q.public_payload->'targets') into total_words
      from private.question_versions q where q.id = question_version;
      if total_words > 0 and jsonb_array_length(found_word_ids) > 0 then
        new.review_state := jsonb_build_object('type', 'word-search', 'foundWordIds', found_word_ids);
        new.points := least(item_points - 1, item_points * jsonb_array_length(found_word_ids) / total_words);
        new.result_details := jsonb_build_object('type', 'word-search', 'timeoutPartialCredit', true,
          'foundWords', jsonb_array_length(found_word_ids), 'totalWords', total_words,
          'incorrectSelections', incorrect_selections, 'solved', false);
        if new.points > 0 then new.status := 'partial'; end if;
      end if;
      return new;
    end if;
    if challenge_mode = 'pyramid' and
      (checkpoint_saved_at is null or checkpoint_saved_at < r.presented_at or checkpoint_saved_at >= checkpoint_deadline)
    then return new; end if;

    new.review_state := private.attempt_review_state(a.id, new.challenge_item_id);
    -- A saved board with all crowns fixed can be solved without any own placements.
    if pyramid_queens and new.review_state is null and a.progress_payload->>'kind' = 'queens'
      and a.progress_payload->>'challengeItemId' = new.challenge_item_id::text then
      select jsonb_build_object('type', 'queens', 'queens', a.progress_payload->'queens') into new.review_state
      from private.question_versions q
      where q.id = question_version and jsonb_array_length(q.public_payload->'prefilledQueens')
        = (q.public_payload->'grid'->>'rows')::integer;
    end if;
    if new.review_state->>'type' = 'queens' then
      select q.public_payload, to_jsonb(array(
        select value::integer from jsonb_array_elements_text(s.solution_payload->'solution')
        order by value::integer
      )) into public_payload, solution
      from private.question_versions q
      join private.question_version_solutions s on s.question_version_id = q.id
      where q.id = question_version;
      queens_progress := private.queens_progress(a.id, new.challenge_item_id);
      checkpoint_solved := new.review_state->'queens' = solution
        and (queens_progress->>'solved')::boolean;
      if pyramid_queens and (queens_progress->>'incorrectValidations')::integer >= 3 then
        return new;
      end if;
      if not checkpoint_solved and (pyramid_queens
        or challenge_config = '{"queensTimeoutPartialCredit":true}'::jsonb) then
        required_placements := (public_payload->'grid'->>'rows')::integer
          - jsonb_array_length(public_payload->'prefilledQueens');
        select count(distinct cell.value)::integer into correct_placements
        from jsonb_array_elements(new.review_state->'queens') cell(value)
        where solution @> jsonb_build_array(cell.value)
          and not (public_payload->'prefilledQueens' @> jsonb_build_array(cell.value));
        if required_placements > 0 then
          new.points := least(item_points - 1, item_points * correct_placements / required_placements);
        end if;
      end if;
      if pyramid_queens then
        new.result_details := jsonb_build_object('type', 'queens',
          'placedQueens', queens_progress->'placedQueens', 'completedRows', queens_progress->'completedRows',
          'completedColumns', queens_progress->'completedColumns', 'completedRegions', queens_progress->'completedRegions',
          'conflictingQueens', queens_progress->'conflictingQueens', 'incorrectAttempts', queens_progress->'incorrectValidations',
          'marksUsed', 0, 'solved', checkpoint_solved);
        if not checkpoint_solved then
          new.result_details := new.result_details || jsonb_build_object('timeoutPartialCredit', true,
            'correctPlacements', correct_placements, 'requiredPlacements', required_placements);
        end if;
      end if;
    elsif new.review_state->>'type' = 'connect-pairs' then
      select q.public_payload into public_payload
      from private.question_versions q where q.id = question_version;
      checkpoint_solved := private.connect_pairs_answer_valid(
        public_payload, jsonb_build_object('paths', new.review_state->'paths'));
      if not checkpoint_solved and (pyramid_connect_pairs
        or challenge_config = '{"connectPairsTimeoutPartialCredit":true}'::jsonb) then
        total_pairs := jsonb_array_length(public_payload->'pairs');
        total_cells := (public_payload->'grid'->>'rows')::integer * (public_payload->'grid'->>'columns')::integer;
        -- The review snapshot has already passed the draft validator, including overlap checks.
        select count(*)::integer, coalesce(sum(jsonb_array_length(route.path)), 0)::integer
          into connected_pairs, covered_cells
        from jsonb_array_elements(public_payload->'pairs') pair(value)
        cross join lateral (select new.review_state->'paths'->(pair.value->>'id') as path) route
        where (route.path->0 = pair.value->'endpoints'->0 and route.path->-1 = pair.value->'endpoints'->1)
           or (route.path->0 = pair.value->'endpoints'->1 and route.path->-1 = pair.value->'endpoints'->0);
        new.points := least(item_points - 1, item_points * connected_pairs / total_pairs,
          item_points * covered_cells / total_cells);
        new.result_details := jsonb_build_object('type', 'connect-pairs', 'timeoutPartialCredit', true,
          'connectedPairs', connected_pairs, 'totalPairs', total_pairs, 'coveredCells', covered_cells,
          'totalCells', total_cells, 'coverage', covered_cells::numeric / total_cells, 'conflicts', 0);
      end if;
    end if;
    if checkpoint_solved then
      new.status := 'correct';
      new.points := item_points;
      if pyramid_connect_pairs or pyramid_queens then
        -- Score the solved checkpoint at its accepted save time.
        saved_speed_score := round(item_points * (1 - 0.4 *
          floor(extract(epoch from (checkpoint_saved_at - r.presented_at)) * 1000)
            / (extract(epoch from (checkpoint_deadline - r.presented_at)) * 1000)))::integer;
        new.points := saved_speed_score;
        if pyramid_queens then
          new.points := greatest(0, greatest(saved_speed_score, ceil(item_points * 0.6)::integer)
            - round(item_points * 0.05)::integer * (queens_progress->>'incorrectValidations')::integer);
        end if;
      end if;
      if not pyramid_queens then new.result_details := null; end if;
    elsif new.points > 0 then
      new.status := 'partial';
    end if;
  end if;
  if new.points > item_points then raise exception 'Points exceed item allocation'; end if;
  return new;
end;
$$;

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
    'points', saved.points) || jsonb_strip_nulls(jsonb_build_object('reviewState', saved.review_state,
      'details', case when saved.result_details->'timeoutPartialCredit' = 'true'::jsonb
        or (cv.mode = 'pyramid' and receipt.timed_out and saved.status = 'correct'
          and saved.review_state->>'type' = 'queens') then saved.result_details end));
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$$;

create or replace function private.handle_attempt_submission(
  op text,
  input jsonb,
  target_attempt public.attempts,
  target_version private.challenge_versions,
  instant timestamptz,
  received_at timestamptz
) returns table(updated_attempt public.attempts, operation_result jsonb, clear_progress boolean)
language plpgsql volatile security invoker set search_path = '' as $$
declare
  a public.attempts%rowtype := target_attempt;
  cv private.challenge_versions%rowtype := target_version;
  received timestamptz := received_at;
  question_type text;
  question_payload jsonb;
  segment private.interaction_intervals%rowtype;
  item private.challenge_items%rowtype;
  unit private.attempt_timing_units%rowtype;
  receipt private.answer_receipts%rowtype;
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  late boolean;
  result jsonb;
begin
  clear_progress := false;
  if cv.mode = 'time-trial' then received := clock_timestamp(); end if;
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if cv.mode = 'time-trial' then
    select q.type, q.public_payload into question_type, question_payload
      from private.question_versions q where q.id = item.question_version_id;
    if question_type = 'queens' and (op = 'pass' or received < a.deadline_at) then
      raise exception 'queens_requires_validation_command' using errcode = '22023';
    elsif question_type = 'connect-pairs' then
      if op = 'pass' then raise exception 'pass_unavailable' using errcode = '55000'; end if;
      if received >= a.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
      if not private.connect_pairs_answer_valid(question_payload, input->'answer') then
        raise exception 'invalid_connect_pairs_answer' using errcode = '22023';
      end if;
    end if;
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'matching'
  ) and (
    (instant < unit.deadline_at and not private.matching_answer_valid(
      (select q.public_payload from private.question_versions q where q.id = item.question_version_id),
      input->'answer',
      true
    ))
    or (instant >= unit.deadline_at and jsonb_typeof(input->'answer') <> 'null'
      and not private.matching_answer_valid(
        (select q.public_payload from private.question_versions q where q.id = item.question_version_id),
        input->'answer',
        false
      ))
  ) then
    raise exception 'invalid_matching_answer' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'mini-wordle'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'mini_wordle_requires_guess_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'logic-code'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'logic_code_requires_attempt_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'queens'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'queens_requires_placement_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'word-search'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'word_search_requires_selection_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'word-hashtag'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'word_hashtag_requires_swap_command' using errcode = '22023';
  end if;
  -- Entry time is captured before locks/evaluation. A stale request cannot predate presentation.
  if received < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  late := received >= unit.deadline_at;
  effective := least(received, unit.deadline_at);
  if op = 'pass' and (cv.mode <> 'alphabet' or late) then raise exception 'pass_unavailable' using errcode = '55000'; end if;
  update private.interaction_intervals set ended_at = effective,
    end_reason = case when op = 'pass' then 'pass' when late then 'timeout' else 'answer' end where id = segment.id;
  if op = 'pass' then result := jsonb_build_object('passed', true);
  else
    select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
      into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
    insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer,
      received_at, presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, segment.challenge_item_id, a.challenge_version_id,
      case when late and cv.mode = 'pyramid'
        and cv.mode_config->'connectPairsTimeoutPartialCredit' = 'true'::jsonb
        and exists (select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'connect-pairs') then null
      when input->'answer' = 'null'::jsonb and exists (
        select 1 from private.question_versions timeout_question
        where timeout_question.id = item.question_version_id and timeout_question.type = 'word-hashtag'
      ) then coalesce(a.progress_payload->'answer', jsonb_build_object('swaps', '[]'::jsonb))
      else input->'answer' end,
      received, presented,
      effective, used_ms, late, (input->>'clientTimeUsedMs')::bigint) returning * into receipt;
    if input->'answer' = 'null'::jsonb and exists (
      select 1 from private.question_versions timeout_question
      where timeout_question.id = item.question_version_id and timeout_question.type = 'word-hashtag'
    ) then
      clear_progress := true;
    end if;
    result := jsonb_build_object('receiptId', receipt.id, 'timedOut', late, 'timeUsedMs', used_ms,
      'receivedAt', received, 'presentedAt', presented);
  end if;
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$$;

create or replace function private.save_connect_pairs_draft(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  instant timestamptz := clock_timestamp();
  expected bigint;
  snapshot jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','paths']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','paths'
    ]))
    or jsonb_typeof(input->'paths') is distinct from 'object' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'save_connect_pairs_draft' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  perform private.authorize_attempt_replay((input->>'attemptId')::uuid, safe_input->>'sessionToken');
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    perform private.raise_if_session_transferred(a.id, safe_input->>'sessionToken');
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  instant := clock_timestamp();
  if a.deadline_at is not null and instant >= a.deadline_at
    and exists (select 1 from private.challenge_versions cv where cv.id = a.challenge_version_id and cv.mode = 'time-trial') then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  if instant >= unit.deadline_at and exists (
    select 1 from private.challenge_versions cv where cv.id = a.challenge_version_id
      and cv.mode = 'pyramid' and cv.mode_config->'connectPairsTimeoutPartialCredit' = 'true'::jsonb
  ) then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'connect-pairs' or question.payload_schema_version <> 1
    or not private.connect_pairs_draft_valid(question.public_payload, jsonb_build_object('paths', input->'paths')) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  snapshot := jsonb_build_object('type', 'connect-pairs', 'paths', input->'paths');
  update public.attempts set
    progress_payload = jsonb_build_object('kind', 'connect-pairs', 'challengeItemId', item.id,
      'paths', input->'paths', 'savedAt', instant),
    lock_version = lock_version + 1,
    last_activity_at = instant
  where id = a.id returning * into a;
  result := jsonb_build_object('attemptId', a.id, 'challengeItemId', item.id,
    'lockVersion', a.lock_version, 'reviewState', snapshot);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'save_connect_pairs_draft', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'save_connect_pairs_draft', safe_input, result);
  return result;
end;
$$;

create or replace function private.save_queens_draft(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  instant timestamptz := clock_timestamp();
  expected bigint;
  candidate integer[];
  prefilled integer[];
  normalized integer[];
  board_size integer;
  cell_count integer;
  progress jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','queens']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','queens'
    ]))
    or jsonb_typeof(input->'queens') is distinct from 'array'
    or jsonb_array_length(input->'queens') > 64
    or exists (
      select 1 from jsonb_array_elements(input->'queens') value
      where jsonb_typeof(value) is distinct from 'number'
        or (value #>> '{}')::numeric <> trunc((value #>> '{}')::numeric)
        or (value #>> '{}')::integer not between 0 and 63
    ) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into candidate from jsonb_array_elements_text(input->'queens') value;
  if (select count(*) from unnest(candidate)) <> (select count(distinct cell) from unnest(candidate) cell) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'save_queens_draft' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  perform private.authorize_attempt_replay((input->>'attemptId')::uuid, safe_input->>'sessionToken');
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    perform private.raise_if_session_transferred(a.id, safe_input->>'sessionToken');
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  instant := clock_timestamp();
  if exists (
    select 1 from private.challenge_versions cv
    where cv.id = a.challenge_version_id
      and (cv.mode = 'time-trial' and instant >= a.deadline_at
        or cv.mode = 'pyramid' and cv.mode_config->'queensTimeoutPartialCredit' = 'true'::jsonb
          and exists (select 1 from private.attempt_timing_units timing
            where timing.id = segment.timing_unit_id and instant >= timing.deadline_at))
  ) then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'queens' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  board_size := (question.public_payload->'grid'->>'rows')::integer;
  if board_size not between 4 and 8
    or (question.public_payload->'grid'->>'columns')::integer <> board_size then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  cell_count := board_size * board_size;
  if exists (select 1 from unnest(candidate) cell where cell not between 0 and cell_count - 1) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into prefilled from jsonb_array_elements_text(coalesce(question.public_payload->'prefilledQueens', '[]'::jsonb)) value;
  select coalesce(array_agg(cell order by cell), '{}'::integer[]) into normalized
  from (
    select distinct cell from unnest(candidate) cell
    union
    select distinct cell from unnest(prefilled) cell
  ) cells;
  if coalesce(array_length(normalized, 1), 0) > board_size then
    raise exception 'queens_answer_overflow' using errcode = '22023';
  end if;
  update public.attempts
    set progress_payload = jsonb_build_object('kind', 'queens', 'challengeItemId', item.id,
          'queens', to_jsonb(normalized), 'savedAt', instant),
        lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  progress := private.queens_progress(a.id, item.id);
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'queens', progress->'queens', 'placedQueens', progress->'placedQueens',
    'completedRows', progress->'completedRows', 'completedColumns', progress->'completedColumns',
    'completedRegions', progress->'completedRegions', 'conflictingQueens', progress->'conflictingQueens',
    'solved', progress->'solved',
    'incorrectValidations', progress->'incorrectValidations',
    'maxIncorrectValidations', progress->'maxIncorrectValidations');
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'save_queens_draft', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'save_queens_draft', safe_input, result);
  return result;
end;
$$;

create or replace function private.submit_queens_answer(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  validation private.queens_validation_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  candidate integer[];
  prefilled integer[];
  normalized integer[];
  solution integer[];
  board_size integer;
  cell_count integer;
  progress jsonb;
  correct boolean;
  terminal boolean;
  sequence_no integer;
  incorrect_attempts integer;
  penalty_points integer;
  challenge_mode text;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','queens']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','queens'
    ]))
    or jsonb_typeof(input->'queens') is distinct from 'array'
    or jsonb_array_length(input->'queens') > 64
    or exists (
      select 1 from jsonb_array_elements(input->'queens') value
      where jsonb_typeof(value) is distinct from 'number'
        or (value #>> '{}')::numeric <> trunc((value #>> '{}')::numeric)
        or (value #>> '{}')::integer not between 0 and 63
    ) then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into candidate from jsonb_array_elements_text(input->'queens') value;
  if (select count(*) from unnest(candidate)) <> (select count(distinct cell) from unnest(candidate) cell) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_queens_answer' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  perform private.authorize_attempt_replay((input->>'attemptId')::uuid, safe_input->>'sessionToken');
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    perform private.raise_if_session_transferred(a.id, safe_input->>'sessionToken');
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  instant := clock_timestamp();
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if expected is distinct from a.lock_version and not (
    expected = a.lock_version - 1
    and instant < unit.deadline_at
    and (a.deadline_at is null or not exists (
      select 1 from private.challenge_versions cv
      where cv.id = a.challenge_version_id and cv.mode = 'time-trial'
    ) or instant < a.deadline_at)
  ) then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  instant := clock_timestamp();
  if exists (
    select 1 from private.challenge_versions cv
    where cv.id = a.challenge_version_id
      and (cv.mode = 'time-trial' and instant >= a.deadline_at
        or cv.mode = 'pyramid' and cv.mode_config->'queensTimeoutPartialCredit' = 'true'::jsonb
          and exists (select 1 from private.attempt_timing_units timing
            where timing.id = segment.timing_unit_id and instant >= timing.deadline_at))
  ) then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'queens' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  board_size := (question.public_payload->'grid'->>'rows')::integer;
  if board_size not between 4 and 8
    or (question.public_payload->'grid'->>'columns')::integer <> board_size then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  cell_count := board_size * board_size;
  if coalesce(array_length(candidate, 1), 0) > board_size then
    raise exception 'queens_answer_overflow' using errcode = '22023';
  end if;
  if coalesce(array_length(candidate, 1), 0) < board_size then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(candidate) cell where cell not between 0 and cell_count - 1) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into prefilled from jsonb_array_elements_text(coalesce(question.public_payload->'prefilledQueens', '[]'::jsonb)) value;
  select coalesce(array_agg(cell order by cell), '{}'::integer[]) into normalized
  from (
    select distinct cell from unnest(candidate) cell
    union
    select distinct cell from unnest(prefilled) cell
  ) cells;
  if coalesce(array_length(normalized, 1), 0) > board_size then
    raise exception 'queens_answer_overflow' using errcode = '22023';
  end if;
  if coalesce(array_length(normalized, 1), 0) < board_size then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;
  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into solution
  from private.question_version_solutions qs
  cross join jsonb_array_elements_text(qs.solution_payload->'solution') value
  where qs.question_version_id = question.id;
  update public.attempts
    set progress_payload = jsonb_build_object('kind', 'queens', 'challengeItemId', item.id,
          'queens', to_jsonb(normalized), 'savedAt', instant),
        lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id;
  progress := private.queens_progress(a.id, item.id);
  correct := (progress->>'solved')::boolean and normalized = solution;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.queens_validation_events e where e.attempt_id = a.id and e.challenge_item_id = item.id;
  select mode into challenge_mode from private.challenge_versions where id = a.challenge_version_id;
  penalty_points := case when correct or challenge_mode = 'time-trial' then 0 else round(item.points * 0.05)::integer end;
  insert into private.queens_validation_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, queens, correct,
    conflicting_queens, penalty_applied, penalty_points, received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, sequence_no, normalized, correct,
    (progress->>'conflictingQueens')::integer, not correct and challenge_mode <> 'time-trial', penalty_points,
    instant, presented, used_ms, key)
  returning * into validation;
  progress := private.queens_progress(a.id, item.id);
  incorrect_attempts := (progress->>'incorrectValidations')::integer;
  terminal := correct or coalesce(incorrect_attempts >= (progress->>'maxIncorrectValidations')::integer, false);
  if terminal then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, private.queens_answer(a.id, item.id), instant,
      presented, effective, used_ms, false, null) returning * into receipt;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'correct', correct, 'terminal', terminal, 'queens', progress->'queens',
    'placedQueens', progress->'placedQueens', 'completedRows', progress->'completedRows',
    'completedColumns', progress->'completedColumns', 'completedRegions', progress->'completedRegions',
    'conflictingQueens', progress->'conflictingQueens', 'solved', progress->'solved',
    'incorrectAttempts', incorrect_attempts,
    'incorrectValidations', incorrect_attempts,
    'maxIncorrectValidations', progress->'maxIncorrectValidations');
  if terminal then result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms); end if;
  if challenge_mode = 'time-trial' then result := result || jsonb_build_object('timeTrial', private.time_trial_progress(a.id)); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_queens_answer', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected, 'queens', to_jsonb(normalized)),
      jsonb_build_object('lockVersion', a.lock_version, 'correct', correct, 'incorrectAttempts', incorrect_attempts));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_queens_answer', safe_input, result);
  return result;
end;
$$;

create or replace function private.submit_word_search_selection(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  solution private.question_version_solutions%rowtype;
  event private.word_search_selection_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  sequence_no integer;
  start_cell_i integer;
  end_cell_i integer;
  target_id text;
  total_words integer;
  grid_rows integer;
  grid_columns integer;
  start_row_i integer;
  start_col_i integer;
  end_row_i integer;
  end_col_i integer;
  terminal boolean;
  progress jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','startCell','endCell']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','startCell','endCell','clientTimeUsedMs'
    ]))
    or jsonb_typeof(input->'startCell') is distinct from 'number'
    or jsonb_typeof(input->'endCell') is distinct from 'number'
    or (input->>'startCell')::numeric <> trunc((input->>'startCell')::numeric)
    or (input->>'endCell')::numeric <> trunc((input->>'endCell')::numeric) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  start_cell_i := (input->>'startCell')::integer;
  end_cell_i := (input->>'endCell')::integer;
  if start_cell_i < 0 or end_cell_i < 0 or start_cell_i = end_cell_i then
    raise exception 'invalid_word_search_selection' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_word_search_selection' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  perform private.authorize_attempt_replay((input->>'attemptId')::uuid, safe_input->>'sessionToken');
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    perform private.raise_if_session_transferred(a.id, safe_input->>'sessionToken');
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if exists (select 1 from private.challenge_versions cv
    where cv.id = a.challenge_version_id and cv.mode = 'pyramid'
      and cv.mode_config->'wordSearchTimeoutPartialCredit' = 'true'::jsonb
  ) then instant := clock_timestamp(); end if;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'word-search' or question.payload_schema_version <> 1
    or jsonb_typeof(question.public_payload->'grid') is distinct from 'object'
    or jsonb_typeof(question.public_payload->'letters') is distinct from 'array'
    or jsonb_typeof(question.public_payload->'targets') is distinct from 'array'
    or jsonb_typeof(solution.solution_payload->'positionsByTargetId') is distinct from 'object' then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  total_words := jsonb_array_length(question.public_payload->'targets');
  grid_rows := (question.public_payload->'grid'->>'rows')::integer;
  grid_columns := (question.public_payload->'grid'->>'columns')::integer;

  select positions.key into target_id
  from jsonb_each(solution.solution_payload->'positionsByTargetId') positions
  where (positions.value->>'startCell')::integer in (start_cell_i, end_cell_i)
    and (positions.value->>'endCell')::integer in (start_cell_i, end_cell_i)
    and (positions.value->>'startCell')::integer <> (positions.value->>'endCell')::integer
  limit 1;
  if target_id is null then
    start_row_i := floor(start_cell_i / grid_columns);
    start_col_i := start_cell_i % grid_columns;
    end_row_i := floor(end_cell_i / grid_columns);
    end_col_i := end_cell_i % grid_columns;
    if start_cell_i >= grid_rows * grid_columns or end_cell_i >= grid_rows * grid_columns
      or not (start_row_i = end_row_i or start_col_i = end_col_i or abs(start_row_i - end_row_i) = abs(start_col_i - end_col_i)) then
      raise exception 'invalid_word_search_selection' using errcode = '22023';
    end if;
  end if;
  if exists (select 1 from private.word_search_selection_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id
      and e.correct and e.matched_target_id = target_id) then
    raise exception 'word_search_target_already_found' using errcode = '55000';
  end if;

  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.word_search_selection_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then
    raise exception 'request_predates_presentation' using errcode = '40001';
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms
    from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;

  insert into private.word_search_selection_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence,
    start_cell, end_cell, matched_target_id, correct,
    received_at, presented_at, time_used_ms, idempotency_key
  ) values (
    a.id, item.id, a.challenge_version_id, sequence_no,
    start_cell_i, end_cell_i, target_id, target_id is not null,
    instant, presented, used_ms, key
  ) returning * into event;

  progress := private.word_search_progress(a.id, item.id);
  terminal := (progress->>'foundCount')::integer = total_words;
  if terminal then
    update private.interaction_intervals
      set ended_at = effective, end_reason = 'answer'
      where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms
    ) values (
      a.id, item.id, a.challenge_version_id, jsonb_build_object('foundWordIds', progress->'foundWordIds'), instant, presented,
      effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint
    ) returning * into receipt;
  end if;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'startCell', event.start_cell, 'endCell', event.end_cell,
    'correct', event.correct, 'terminal', terminal,
    'matchedTargetId', event.matched_target_id,
    'foundSelections', progress->'foundSelections', 'foundWordIds', progress->'foundWordIds',
    'foundCount', progress->'foundCount', 'totalWords', progress->'totalWords',
    'incorrectAttempts', progress->'incorrectAttempts'
  );
  if terminal then
    result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms);
  end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_word_search_selection', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'startCell', event.start_cell,
        'endCell', event.end_cell, 'correct', event.correct, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_word_search_selection', safe_input, result);
  return result;
end;
$$;

drop function private.is_valid_pyramid_config(jsonb, boolean);
