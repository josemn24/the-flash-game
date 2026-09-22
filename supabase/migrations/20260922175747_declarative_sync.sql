SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.word_hashtag_progress (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  public_payload jsonb;
  solution_payload jsonb;
  progress_payload jsonb;
  letters text[];
  solution text[];
  swap jsonb;
  from_cell integer;
  to_cell integer;
  moves_used integer := 0;
  index integer;
  temporary text;
  solved boolean := false;
begin
  select q.public_payload, qs.solution_payload, a.progress_payload
    into public_payload, solution_payload, progress_payload
    from public.attempts a
    join private.challenge_items i on i.challenge_version_id = a.challenge_version_id
    join private.question_versions q on q.id = i.question_version_id
    join private.question_version_solutions qs on qs.question_version_id = q.id
    where a.id = target_attempt and i.id = target_item and q.type = 'word-hashtag';
  if public_payload is null or solution_payload is null then return null; end if;

  select array_agg(nullif(value #>> '{}', '') order by ordinality)
    into solution from jsonb_array_elements(private.word_hashtag_solution_letters(solution_payload)) with ordinality;
  letters := array_fill(null::text, array[25]);
  for index in 0..24 loop
    letters[index + 1] := nullif(public_payload->'initialLetters'->>index, '');
  end loop;
  for swap in select value from jsonb_array_elements(
    coalesce(progress_payload->'answer'->'swaps', '[]'::jsonb)
  ) loop
    from_cell := (swap->>'fromCell')::integer;
    to_cell := (swap->>'toCell')::integer;
    if from_cell between 0 and 24 and to_cell between 0 and 24 then
      temporary := letters[from_cell + 1];
      letters[from_cell + 1] := letters[to_cell + 1];
      letters[to_cell + 1] := temporary;
    end if;
    moves_used := moves_used + 1;
  end loop;
  solved := true;
  for index in 1..25 loop
    if letters[index] is distinct from solution[index] then solved := false; exit; end if;
  end loop;
  return jsonb_build_object(
    'kind', 'word-hashtag',
    'letters', to_jsonb(letters),
    'swaps', coalesce(progress_payload->'answer'->'swaps', '[]'::jsonb),
    'movesUsed', moves_used,
    'movesRemaining', greatest(0, (public_payload->>'maxMoves')::integer - moves_used),
    'solved', solved
  );
end;
$function$;
