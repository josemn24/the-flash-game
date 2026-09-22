begin;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'private.escape_content_valid(jsonb,jsonb)', 'EXECUTE'),
  'Anonymous cannot invoke the Escape content validator');
select ok(not has_function_privilege('service_role', 'private.escape_content_valid(jsonb,jsonb)', 'EXECUTE'),
  'service_role cannot invoke the Escape content validator directly');
select ok(
  (select prosecdef from pg_proc where oid = 'private.escape_content_valid(jsonb,jsonb)'::regprocedure),
  'Escape validator is SECURITY DEFINER'
);

select ok(private.escape_content_valid(
  jsonb_build_object(
    'question', 'Libera el bloque amarillo.',
    'grid', jsonb_build_object('rows', 6, 'columns', 6, 'exit', jsonb_build_object('side', 'right', 'row', 2)),
    'initialBlocks', jsonb_build_array(
      jsonb_build_object('id', 'target', 'kind', 'target', 'orientation', 'horizontal', 'row', 2, 'column', 0, 'length', 2),
      jsonb_build_object('id', 'a', 'kind', 'obstacle', 'orientation', 'vertical', 'row', 1, 'column', 2, 'length', 2),
      jsonb_build_object('id', 'b', 'kind', 'obstacle', 'orientation', 'vertical', 'row', 0, 'column', 4, 'length', 3),
      jsonb_build_object('id', 'c', 'kind', 'obstacle', 'orientation', 'horizontal', 'row', 0, 'column', 1, 'length', 2),
      jsonb_build_object('id', 'd', 'kind', 'obstacle', 'orientation', 'horizontal', 'row', 4, 'column', 1, 'length', 2)
    )
  ),
  jsonb_build_object(
    'referenceSolution', jsonb_build_array(
      jsonb_build_object('blockId', 'c', 'from', 1, 'to', 0),
      jsonb_build_object('blockId', 'a', 'from', 1, 'to', 0),
      jsonb_build_object('blockId', 'b', 'from', 0, 'to', 3),
      jsonb_build_object('blockId', 'target', 'from', 0, 'to', 4)
    ),
    'optimalMoves', 4
  )
), 'A valid Escape reference sequence is accepted');

select ok(not private.escape_content_valid(
  jsonb_build_object(
    'question', 'Libera el bloque amarillo.',
    'grid', jsonb_build_object('rows', 6, 'columns', 6, 'exit', jsonb_build_object('side', 'right', 'row', 2)),
    'initialBlocks', jsonb_build_array(
      jsonb_build_object('id', 'target', 'kind', 'target', 'orientation', 'horizontal', 'row', 2, 'column', 0, 'length', 2),
      jsonb_build_object('id', 'target', 'kind', 'obstacle', 'orientation', 'vertical', 'row', 1, 'column', 2, 'length', 2)
    )
  ),
  jsonb_build_object('referenceSolution', '[]'::jsonb, 'optimalMoves', 1)
), 'Duplicate block ids are rejected');

select ok(not private.escape_content_valid(
  jsonb_build_object(
    'question', 'Libera el bloque amarillo.',
    'grid', jsonb_build_object('rows', 6, 'columns', 6, 'exit', jsonb_build_object('side', 'right', 'row', 2)),
    'initialBlocks', jsonb_build_array(
      jsonb_build_object('id', 'target', 'kind', 'target', 'orientation', 'horizontal', 'row', 2, 'column', 0, 'length', 2)
    )
  ),
  jsonb_build_object('referenceSolution', '[]'::jsonb, 'optimalMoves', 0)
), 'Incomplete Escape solutions are rejected');

select * from finish();
rollback;
