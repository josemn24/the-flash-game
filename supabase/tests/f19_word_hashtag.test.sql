begin;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'private.word_hashtag_content_valid(jsonb,jsonb)', 'EXECUTE'),
  'Anonymous cannot invoke the Word-hashtag content validator');
select ok(not has_function_privilege('service_role', 'private.word_hashtag_content_valid(jsonb,jsonb)', 'EXECUTE'),
  'service_role cannot invoke the Word-hashtag content validator directly');
select ok(not has_function_privilege('anon', 'private.submit_word_hashtag_swap(jsonb)', 'EXECUTE'),
  'Anonymous cannot invoke the Word-hashtag swap command');

select ok(private.word_hashtag_content_valid(
  jsonb_build_object(
    'question', 'Intercambia las letras.',
    'grid', jsonb_build_object('rows', 5, 'columns', 5),
    'initialLetters', jsonb_build_array(
      null, 'G', null, 'Q', null,
      'E', 'O', 'P', 'U', 'I',
      null, 'N', null, 'Y', null,
      'R', 'A', 'U', 'M', 'E',
      null, 'R', null, 'A', null
    ),
    'maxMoves', 7
  ),
  jsonb_build_object('words', jsonb_build_object(
    'top', 'YOGUI', 'bottom', 'REUMA', 'left', 'PONER', 'right', 'QUEMA'
  ))
), 'A valid Word-hashtag editorial contract is accepted');

select ok(not private.word_hashtag_content_valid(
  jsonb_build_object(
    'question', 'Intercambia las letras.',
    'grid', jsonb_build_object('rows', 5, 'columns', 5),
    'initialLetters', jsonb_build_array(
      null, 'G', null, 'Q', null,
      'E', 'O', 'P', 'U', 'I',
      null, 'N', null, 'Y', null,
      'R', 'A', 'U', 'M', 'E',
      null, 'R', null, 'A', null
    ),
    'maxMoves', 7
  ),
  jsonb_build_object('words', jsonb_build_object(
    'top', 'YOGUI', 'bottom', 'REUMA', 'left', 'PONER', 'right', 'OTRA'
  ))
), 'Inconsistent Word-hashtag crossings are rejected');

select * from finish();
rollback;
