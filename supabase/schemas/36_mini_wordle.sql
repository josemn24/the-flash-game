-- E01 Mini-Wordle. These tables are deliberately private: Data API clients
-- must only receive the public payload and the feedback produced by the command.
-- The general dictionary is combined at command time with the question-local
-- additionalGuesses array stored in the private solution payload.
set local check_function_bodies = off;
create table private.mini_wordle_dictionary_words (
  dictionary_id text not null check (dictionary_id in ('es-general-4.v1', 'es-general-5.v1')),
  word_length smallint not null check (word_length in (4, 5)),
  word text not null,
  primary key (dictionary_id, word),
  check ((dictionary_id = 'es-general-4.v1' and word_length = 4)
    or (dictionary_id = 'es-general-5.v1' and word_length = 5)),
  check (char_length(word) = word_length),
  check (word = upper(word) and word ~ '^[A-ZÑ]+$')
);

create index mini_wordle_dictionary_lookup_idx
  on private.mini_wordle_dictionary_words(dictionary_id, word_length, word);

create table private.mini_wordle_guess_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  challenge_version_id uuid not null,
  sequence smallint not null check (sequence > 0 and sequence <= 10),
  guess text not null check (guess = upper(guess) and guess ~ '^[A-ZÑ]+$'),
  feedback jsonb not null check (jsonb_typeof(feedback) = 'array'),
  solved boolean not null,
  received_at timestamptz not null default clock_timestamp(),
  presented_at timestamptz not null,
  time_used_ms bigint not null check (time_used_ms >= 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  foreign key (attempt_id, challenge_version_id)
    references public.attempts(id, challenge_version_id) on delete restrict,
  foreign key (challenge_item_id, challenge_version_id)
    references private.challenge_items(id, challenge_version_id) on delete restrict,
  unique (attempt_id, challenge_item_id, sequence),
  unique (attempt_id, challenge_item_id, guess),
  unique (attempt_id, idempotency_key),
  check (received_at >= presented_at)
);

alter table private.mini_wordle_dictionary_words enable row level security;
alter table private.mini_wordle_guess_events enable row level security;
revoke all on private.mini_wordle_dictionary_words, private.mini_wordle_guess_events
  from public, anon, authenticated, service_role;

create function private.mini_wordle_normalize(value text) returns text
language sql immutable set search_path = '' as $$
  select translate(upper(btrim(value)), 'ÁÉÍÓÚÜ', 'AEIOUU')
$$;

create function private.mini_wordle_feedback(guess_value text, solution_value text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  guess_chars text[] := string_to_array(guess_value, null);
  solution_chars text[] := string_to_array(solution_value, null);
  statuses text[] := array_fill('absent'::text, array[coalesce(array_length(guess_chars, 1), 0)]);
  remaining jsonb := '{}'::jsonb;
  letter text;
  i integer;
  result jsonb;
begin
  if guess_chars is null or solution_chars is null then return '[]'::jsonb; end if;
  for i in 1..array_length(guess_chars, 1) loop
    if guess_chars[i] = solution_chars[i] then
      statuses[i] := 'correct';
    else
      letter := solution_chars[i];
      remaining := jsonb_set(remaining, array[letter], to_jsonb(coalesce((remaining->>letter)::integer, 0) + 1), true);
    end if;
  end loop;
  for i in 1..array_length(guess_chars, 1) loop
    if statuses[i] <> 'correct' and coalesce((remaining->>guess_chars[i])::integer, 0) > 0 then
      statuses[i] := 'present';
      remaining := jsonb_set(remaining, array[guess_chars[i]], to_jsonb((remaining->>guess_chars[i])::integer - 1), true);
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('letter', guess_chars[x], 'status', statuses[x]) order by x), '[]'::jsonb)
    into result from generate_series(1, array_length(guess_chars, 1)) as series(x);
  return result;
end;
$$;

create function private.mini_wordle_progress(target_attempt uuid, target_item uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'kind', 'mini-wordle',
    'guesses', coalesce(jsonb_agg(e.guess order by e.sequence) filter (where e.id is not null), '[]'::jsonb),
    'feedback', coalesce(jsonb_agg(e.feedback order by e.sequence) filter (where e.id is not null), '[]'::jsonb),
    'attemptsUsed', count(e.id)::integer,
    'maxAttempts', (q.public_payload->>'maxAttempts')::integer
  )
  from private.challenge_items i
  join private.question_versions q on q.id = i.question_version_id
  left join private.mini_wordle_guess_events e
    on e.attempt_id = target_attempt and e.challenge_item_id = target_item
  where i.id = target_item and q.type = 'mini-wordle'
  group by q.public_payload
$$;
