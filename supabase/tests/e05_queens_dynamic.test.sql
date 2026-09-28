begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

select ok(private.queens_content_valid(
  jsonb_build_object(
    'question', 'Coloca cuatro coronas.',
    'grid', jsonb_build_object('rows', 4, 'columns', 4),
    'regions', jsonb_build_array(1,1,0,0,1,1,0,0,1,1,1,2,3,3,3,2),
    'prefilledQueens', jsonb_build_array(2)),
  jsonb_build_object('solution', jsonb_build_array(2,4,11,13))),
  'Acepta una configuración única 4×4');

select ok(private.queens_content_valid(
  jsonb_build_object(
    'question', 'Coloca seis coronas.',
    'grid', jsonb_build_object('rows', 6, 'columns', 6),
    'regions', jsonb_build_array(
      0,1,1,1,1,1,2,1,1,1,1,1,2,2,1,1,1,5,2,2,1,1,3,5,5,5,4,1,5,5,5,5,5,5,5,5),
    'prefilledQueens', jsonb_build_array(0)),
  jsonb_build_object('solution', jsonb_build_array(0,9,13,22,26,35))),
  'Acepta una configuración única 6×6');

select ok(private.queens_content_valid(
  jsonb_build_object(
    'question', 'Coloca ocho coronas.',
    'grid', jsonb_build_object('rows', 8, 'columns', 8),
    'regions', jsonb_build_array(
      0,0,0,0,0,1,1,1,2,2,2,2,2,1,1,1,2,2,2,2,1,1,1,1,2,2,3,4,4,1,4,1,
      2,2,4,4,4,4,4,5,2,2,4,4,4,5,5,5,2,4,4,6,6,6,5,5,2,4,4,6,6,6,7,5),
    'prefilledQueens', '[]'::jsonb),
  jsonb_build_object('solution', jsonb_build_array(1,13,16,26,36,47,51,62))),
  'Acepta una configuración única 8×8');

select ok(not private.queens_content_valid(
  jsonb_build_object('question', 'No', 'grid', jsonb_build_object('rows', 3, 'columns', 3), 'regions', '[]'::jsonb, 'prefilledQueens', '[]'::jsonb),
  jsonb_build_object('solution', '[]'::jsonb)),
  'Rechaza tamaños inferiores a 4');
select ok(not private.queens_content_valid(
  jsonb_build_object('question', 'No', 'grid', jsonb_build_object('rows', 9, 'columns', 9), 'regions', '[]'::jsonb, 'prefilledQueens', '[]'::jsonb),
  jsonb_build_object('solution', '[]'::jsonb)),
  'Rechaza tamaños superiores a 8');
select ok(not private.queens_content_valid(
  jsonb_build_object('question', 'No', 'grid', jsonb_build_object('rows', 4, 'columns', 5), 'regions', '[]'::jsonb, 'prefilledQueens', '[]'::jsonb),
  jsonb_build_object('solution', '[]'::jsonb)),
  'Rechaza tableros rectangulares');

select * from finish();
rollback;
