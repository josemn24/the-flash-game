SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.word_hashtag_content_valid (
  public_payload   jsonb,
  solution_payload jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  solution jsonb;
  initial jsonb;
  entry jsonb;
  index integer;
  cell integer;
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or jsonb_typeof(solution_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'grid', 'initialLetters', 'maxMoves']
    or exists (select 1 from jsonb_object_keys(public_payload) key_name
      where key_name <> all(array['category', 'tags', 'question', 'grid', 'initialLetters', 'maxMoves']))
    or jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(public_payload->'grid') key_name
      where key_name <> all(array['rows', 'columns']))
    or (public_payload->'grid'->>'rows')::numeric <> 5
    or (public_payload->'grid'->>'columns')::numeric <> 5
    or jsonb_typeof(public_payload->'initialLetters') is distinct from 'array'
    or jsonb_array_length(public_payload->'initialLetters') <> 25
    or jsonb_typeof(public_payload->'maxMoves') is distinct from 'number'
    or (public_payload->>'maxMoves')::numeric <> trunc((public_payload->>'maxMoves')::numeric)
    or (public_payload->>'maxMoves')::integer <= 0
    or not solution_payload ? 'words'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name
      where key_name <> all(array['words', 'explanation'])) then
    return false;
  end if;

  initial := public_payload->'initialLetters';
  for entry, index in select value, ordinality::integer from jsonb_array_elements(initial) with ordinality loop
    cell := index - 1;
    if ((cell / 5) in (0, 2, 4) and (cell % 5) in (0, 2, 4))
      and entry <> 'null'::jsonb then
      return false;
    end if;
    if ((cell / 5) in (1, 3) or (cell % 5) in (1, 3)) then
      if jsonb_typeof(entry) is distinct from 'string'
        or upper(entry #>> '{}') !~ '^[A-ZÑ]$' then
        return false;
      end if;
    elsif entry <> 'null'::jsonb then
      return false;
    end if;
  end loop;

  solution := private.word_hashtag_solution_letters(solution_payload);
  if solution is null then return false; end if;
  if (select count(*) from jsonb_array_elements(solution) s where s.value <> 'null'::jsonb) <> 16 then
    return false;
  end if;
  for index in 0..24 loop
    if initial->index is not null and upper(initial->>index) <> solution->>index then
      return false;
    end if;
  end loop;
  return true;
end;
$function$;
