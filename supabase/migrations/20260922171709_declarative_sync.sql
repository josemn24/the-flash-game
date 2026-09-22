SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.word_hashtag_solution_letters (
  solution_payload jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  IMMUTABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  letters text[] := array_fill(null::text, array[25]);
  word_name text;
  word_value text;
  cells integer[];
  index integer;
  cell integer;
  letter text;
begin
  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ? 'words'
    or jsonb_typeof(solution_payload->'words') is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(solution_payload->'words') key_name
      where key_name <> all(array['top', 'bottom', 'left', 'right'])) then
    return null;
  end if;
  foreach word_name in array ARRAY['top', 'bottom', 'left', 'right'] loop
    word_value := upper(btrim(solution_payload->'words'->>word_name));
    if word_value is null or char_length(word_value) <> 5 or word_value !~ '^[A-ZÑ]+$' then
      return null;
    end if;
    cells := case word_name
      when 'top' then array[5, 6, 7, 8, 9]
      when 'bottom' then array[15, 16, 17, 18, 19]
      when 'left' then array[1, 6, 11, 16, 21]
      else array[3, 8, 13, 18, 23]
    end;
    for index in 1..5 loop
      cell := cells[index];
      letter := substr(word_value, index, 1);
      if letters[cell + 1] is not null and letters[cell + 1] <> letter then
        return null;
      end if;
      letters[cell + 1] := letter;
    end loop;
  end loop;
  return to_jsonb(letters);
end;
$function$;
