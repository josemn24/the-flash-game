-- E03 — Progressive-clues authoritative reveal events.
-- The complete clue list remains private. Only the already granted prefix is
-- returned by the prepare/reveal commands.

create table private.progressive_clue_reveal_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  challenge_version_id uuid not null,
  clue_index integer not null check (clue_index > 0),
  penalty_points integer not null check (penalty_points >= 0),
  available_points integer not null check (available_points >= 0),
  revealed_at timestamptz not null,
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  foreign key (attempt_id, challenge_version_id)
    references public.attempts(id, challenge_version_id),
  foreign key (challenge_item_id, challenge_version_id)
    references private.challenge_items(id, challenge_version_id),
  unique (attempt_id, challenge_item_id, clue_index),
  unique (attempt_id, idempotency_key),
  unique (id, attempt_id, challenge_item_id, challenge_version_id)
);

create index progressive_clue_events_item_idx
  on private.progressive_clue_reveal_events(attempt_id, challenge_item_id, clue_index);

create function private.progressive_clue_effective_penalty(
  configured_penalty integer,
  item_points integer
) returns integer
language sql immutable set search_path = '' as $$
  select case
    when configured_penalty <= 0 or item_points <= 0 then 0
    else greatest(1, round((configured_penalty::numeric / 50) * item_points)::integer)
  end
$$;

create function private.progressive_clues_public_payload(target_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'question', q.public_payload->'question',
    'category', coalesce(q.public_payload->'category', 'null'::jsonb),
    'tags', coalesce(q.public_payload->'tags', '{}'::jsonb),
    'clueCount', jsonb_array_length(q.public_payload->'clues'),
    'cluePenalty', q.public_payload->'cluePenalty'
  )
  from private.challenge_items i
  join private.question_versions q on q.id = i.question_version_id
  where i.id = target_item and q.type = 'progressive-clues'
$$;

create function private.progressive_clues_progress(target_attempt uuid, target_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with content as (
    select
      i.points,
      q.public_payload,
      jsonb_array_length(q.public_payload->'clues') as total_clues,
      private.progressive_clue_effective_penalty(
        (q.public_payload->>'cluePenalty')::integer,
        i.points
      ) as effective_penalty
    from private.challenge_items i
    join private.question_versions q on q.id = i.question_version_id
    where i.id = target_item and q.type = 'progressive-clues'
  ), current_progress as (
    select
      coalesce(max(e.clue_index), 0)::integer as revealed_clues,
      coalesce((array_agg(e.available_points order by e.clue_index desc))[1], c.points)::integer
        as available_points
    from content c
    left join private.progressive_clue_reveal_events e
      on e.attempt_id = target_attempt and e.challenge_item_id = target_item
    group by c.points
  )
  select jsonb_build_object(
    'kind', 'progressive-clues',
    'clues', coalesce((
      select jsonb_agg(value order by ordinality)
      from jsonb_array_elements_text(c.public_payload->'clues') with ordinality
      where ordinality <= p.revealed_clues
    ), '[]'::jsonb),
    'revealedClues', p.revealed_clues,
    'totalClues', c.total_clues,
    'availablePoints', p.available_points,
    'cluePenalty', c.effective_penalty
  )
  from content c cross join current_progress p
$$;

create function private.ensure_progressive_clue_initial(
  target_attempt uuid,
  target_item uuid,
  target_version uuid
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  instant timestamptz := clock_timestamp();
begin
  select * into item from private.challenge_items where id = target_item and challenge_version_id = target_version;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'progressive-clues' then return; end if;

  insert into private.progressive_clue_reveal_events(
    attempt_id, challenge_item_id, challenge_version_id, clue_index,
    penalty_points, available_points, revealed_at, idempotency_key
  )
  values(
    target_attempt, target_item, target_version, 1, 0, item.points, instant,
    'prepare-progressive-clue:' || target_attempt || ':' || target_item
  )
  on conflict (attempt_id, challenge_item_id, clue_index) do nothing;
end;
$$;

alter function private.progressive_clue_effective_penalty(integer, integer) owner to postgres;
alter function private.progressive_clues_public_payload(uuid) owner to postgres;
alter function private.progressive_clues_progress(uuid, uuid) owner to postgres;
alter function private.ensure_progressive_clue_initial(uuid, uuid, uuid) owner to postgres;
revoke all on table private.progressive_clue_reveal_events from public, anon, authenticated, service_role;
revoke all on function private.progressive_clue_effective_penalty(integer, integer),
  private.progressive_clues_public_payload(uuid), private.progressive_clues_progress(uuid, uuid),
  private.ensure_progressive_clue_initial(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
alter table private.progressive_clue_reveal_events enable row level security;
