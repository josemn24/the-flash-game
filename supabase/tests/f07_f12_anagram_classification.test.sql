begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

select lives_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object(
      'slug','f07-f12-final-answer','title','Anagrama y clasificación','subtitle','F07/F12',
      'description','Formatos competitivos finales','mode','flash',
      'configSchemaVersion',1,'modeConfig','{}'::jsonb
    ),
    'questions', jsonb_build_array(
      jsonb_build_object(
        'slug','sbr-race-anagram','type','anagram','payloadSchemaVersion',1,
        'timeLimitMs',30000,'points',50,
        'publicPayload',jsonb_build_object('category','Deporte','tags','{}'::jsonb,
          'question','Forma una palabra relacionada con el desafío.',
          'tiles',jsonb_build_array(
            jsonb_build_object('id','a','value','A'),
            jsonb_build_object('id','c','value','C'),
            jsonb_build_object('id','r-1','value','R'),
            jsonb_build_object('id','r-2','value','R'),
            jsonb_build_object('id','a-2','value','A'),
            jsonb_build_object('id','e','value','E'),
            jsonb_build_object('id','r-3','value','R')),
          'hint',null),
        'solutionPayload',jsonb_build_object('correctAnswer','CARRERA','explanation','Palabra relacionada con la carrera.')),
      jsonb_build_object(
        'slug','sbr-1890-gear-classification','type','classification','payloadSchemaVersion',1,
        'timeLimitMs',22000,'points',50,
        'publicPayload',jsonb_build_object('category','Tecnología','tags','{}'::jsonb,
          'question','Clasifica cada objeto según encaje en 1890.',
          'items',jsonb_build_array(
            jsonb_build_object('label','Brújula'),
            jsonb_build_object('label','Telégrafo'),
            jsonb_build_object('label','Navegador GPS')),
          'categories',jsonb_build_array('útil en 1890','anacrónico')),
        'solutionPayload',jsonb_build_object('categoriesByItem',jsonb_build_object(
          'Brújula','útil en 1890','Telégrafo','útil en 1890','Navegador GPS','anacrónico'),
          'explanation','Clasificación histórica.'))
    )
  ))
$$, 'Acepta un desafío mixto con anagram y classification');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object('slug','invalid-anagram','title','Inválido','subtitle','','description','','mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb),
    'questions', jsonb_build_array(
      jsonb_build_object(
        'slug','invalid-anagram','type','anagram','payloadSchemaVersion',1,'timeLimitMs',12000,'points',50,
        'publicPayload',jsonb_build_object('question','Forma una palabra','tiles',jsonb_build_array(
          jsonb_build_object('id','a','value','A'),jsonb_build_object('id','b','value','B'),jsonb_build_object('id','c','value','C'))),
        'solutionPayload',jsonb_build_object('correctAnswer','ABA')),
      jsonb_build_object(
        'slug','valid-anagram','type','anagram','payloadSchemaVersion',1,'timeLimitMs',12000,'points',50,
        'publicPayload',jsonb_build_object('question','Forma una palabra','tiles',jsonb_build_array(
          jsonb_build_object('id','a','value','A'),jsonb_build_object('id','b','value','B'),jsonb_build_object('id','c','value','C'))),
        'solutionPayload',jsonb_build_object('correctAnswer','CBA'))
    )
  ))
$$, '22023', 'invalid_solution_payload', 'Rechaza una solución que no consume las fichas publicadas');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object('slug','invalid-classification','title','Inválido','subtitle','','description','','mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb),
    'questions', jsonb_build_array(
      jsonb_build_object(
        'slug','invalid-classification','type','classification','payloadSchemaVersion',1,'timeLimitMs',12000,'points',50,
        'publicPayload',jsonb_build_object('question','Clasifica','items',jsonb_build_array(jsonb_build_object('label','Uno'),jsonb_build_object('label','Dos')),'categories',jsonb_build_array('A','B')),
        'solutionPayload',jsonb_build_object('categoriesByItem',jsonb_build_object('Uno','A','Extra','B'))),
      jsonb_build_object(
        'slug','valid-classification','type','classification','payloadSchemaVersion',1,'timeLimitMs',12000,'points',50,
        'publicPayload',jsonb_build_object('question','Clasifica','items',jsonb_build_array(jsonb_build_object('label','Uno'),jsonb_build_object('label','Dos')),'categories',jsonb_build_array('A','B')),
        'solutionPayload',jsonb_build_object('categoriesByItem',jsonb_build_object('Uno','A','Dos','B')))
    )
  ))
$$, '22023', 'invalid_solution_payload', 'Rechaza claves de clasificación desconocidas');

select * from finish();
rollback;
