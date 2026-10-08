begin;

do $$
declare
  save_definition text;
  submit_definition text;
  save_fragment text := $save$
  if coalesce(array_length(normalized, 1), 0) > board_size then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;
$save$;
  submit_candidate_fragment text := $candidate$
  if coalesce(array_length(candidate, 1), 0) <> board_size then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;
$candidate$;
  submit_normalized_fragment text := $normalized$
  if coalesce(array_length(normalized, 1), 0) <> board_size then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;
$normalized$;
begin
  select pg_get_functiondef('private.save_queens_draft(jsonb)'::regprocedure)
    into save_definition;
  if strpos(save_definition, save_fragment) = 0 then
    raise exception 'queens_answer_overflow migration could not find save validation';
  end if;
  save_definition := replace(
    save_definition,
    save_fragment,
    $replacement$
  if coalesce(array_length(normalized, 1), 0) > board_size then
    raise exception 'queens_answer_overflow' using errcode = '22023';
  end if;
$replacement$
  );
  execute save_definition;

  select pg_get_functiondef('private.submit_queens_answer(jsonb)'::regprocedure)
    into submit_definition;
  if strpos(submit_definition, submit_candidate_fragment) = 0
    or strpos(submit_definition, submit_normalized_fragment) = 0 then
    raise exception 'queens_answer_overflow migration could not find submit validation';
  end if;
  submit_definition := replace(
    submit_definition,
    submit_candidate_fragment,
    $replacement$
  if coalesce(array_length(candidate, 1), 0) > board_size then
    raise exception 'queens_answer_overflow' using errcode = '22023';
  end if;
  if coalesce(array_length(candidate, 1), 0) < board_size then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;
$replacement$
  );
  submit_definition := replace(
    submit_definition,
    submit_normalized_fragment,
    $replacement$
  if coalesce(array_length(normalized, 1), 0) > board_size then
    raise exception 'queens_answer_overflow' using errcode = '22023';
  end if;
  if coalesce(array_length(normalized, 1), 0) < board_size then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;
$replacement$
  );
  execute submit_definition;
end;
$$;

commit;
