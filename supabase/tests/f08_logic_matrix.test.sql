begin;
set local search_path=public,extensions;
select no_plan();

select lives_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object(
      'slug','f08-logic-matrix','title','Matrices lógicas','subtitle','F08',
      'description','Formato final de matriz lógica','mode','flash',
      'configSchemaVersion',1,'modeConfig','{}'::jsonb
    ),
    'questions', jsonb_build_array(
      jsonb_build_object(
        'slug','f08-matrix-one','type','logic-matrix','payloadSchemaVersion',1,
        'timeLimitMs',20000,'points',50,
        'publicPayload',jsonb_build_object(
          'category','Lógica','tags','{}'::jsonb,'question','Completa la matriz',
          'pieces',jsonb_build_array(
            jsonb_build_object('id','a','symbol','A','label','A'),
            jsonb_build_object('id','b','symbol','B','label','B'),
            jsonb_build_object('id','c','symbol','C','label','C'),
            jsonb_build_object('id','d','symbol','D','label','D')),
          'cells',jsonb_build_array('a','b','c','b','c','a','c','a',null),
          'optionIds',jsonb_build_array('d','a','b','c'),'showPieceLabels',false),
        'solutionPayload',jsonb_build_object('correctOptionId','d','explanation','La pieza D completa el patrón.')),
      jsonb_build_object(
        'slug','f08-matrix-two','type','logic-matrix','payloadSchemaVersion',1,
        'timeLimitMs',20000,'points',50,
        'publicPayload',jsonb_build_object(
          'question','Completa la matriz',
          'pieces',jsonb_build_array(
            jsonb_build_object('id','a','symbol','A','label','A'),
            jsonb_build_object('id','b','symbol','B','label','B'),
            jsonb_build_object('id','c','symbol','C','label','C'),
            jsonb_build_object('id','d','symbol','D','label','D')),
          'cells',jsonb_build_array('a','b','c','b','c','a','c','a',null),
          'optionIds',jsonb_build_array('d','a','b','c')),
        'solutionPayload',jsonb_build_object('correctOptionId','d'))
    )
  ))
$$, 'Acepta dos preguntas logic-matrix v1 con solución privada');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object(
      'slug','f08-invalid-public','title','Inválido','subtitle','','description','',
      'mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb
    ),
    'questions', jsonb_build_array(
      jsonb_build_object(
        'slug','f08-invalid-public-one','type','logic-matrix','payloadSchemaVersion',1,
        'timeLimitMs',20000,'points',50,
        'publicPayload',jsonb_build_object(
          'question','Completa la matriz','correctOptionId','d',
          'pieces',jsonb_build_array(
            jsonb_build_object('id','a','symbol','A','label','A'),
            jsonb_build_object('id','b','symbol','B','label','B'),
            jsonb_build_object('id','c','symbol','C','label','C'),
            jsonb_build_object('id','d','symbol','D','label','D')),
          'cells',jsonb_build_array('a','b','c','b','c','a','c','a',null),
          'optionIds',jsonb_build_array('d','a','b','c')),
        'solutionPayload',jsonb_build_object('correctOptionId','d')),
      jsonb_build_object(
        'slug','f08-invalid-public-two','type','logic-matrix','payloadSchemaVersion',1,
        'timeLimitMs',20000,'points',50,
        'publicPayload',jsonb_build_object(
          'question','Completa la matriz','pieces',jsonb_build_array(
            jsonb_build_object('id','a','symbol','A','label','A'),
            jsonb_build_object('id','b','symbol','B','label','B'),
            jsonb_build_object('id','c','symbol','C','label','C'),
            jsonb_build_object('id','d','symbol','D','label','D')),
          'cells',jsonb_build_array('a','b','c','b','c','a','c',null,null),
          'optionIds',jsonb_build_array('d','a','b','c')),
        'solutionPayload',jsonb_build_object('correctOptionId','d'))
    )
  ))
$$, '22023', 'invalid_public_payload', 'Rechaza soluciones filtradas y matrices con varias celdas vacías');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object(
      'slug','f08-invalid-solution','title','Inválido','subtitle','','description','',
      'mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb
    ),
    'questions', jsonb_build_array(
      jsonb_build_object(
        'slug','f08-invalid-solution-one','type','logic-matrix','payloadSchemaVersion',1,
        'timeLimitMs',20000,'points',50,
        'publicPayload',jsonb_build_object('question','Completa','pieces',jsonb_build_array(
          jsonb_build_object('id','a','symbol','A','label','A'),jsonb_build_object('id','b','symbol','B','label','B'),
          jsonb_build_object('id','c','symbol','C','label','C'),jsonb_build_object('id','d','symbol','D','label','D')),
          'cells',jsonb_build_array('a','b','c','b','c','a','c','a',null),
          'optionIds',jsonb_build_array('d','a','b','c')),
        'solutionPayload',jsonb_build_object('correctOptionId','missing')),
      jsonb_build_object(
        'slug','f08-invalid-solution-two','type','logic-matrix','payloadSchemaVersion',1,
        'timeLimitMs',20000,'points',50,
        'publicPayload',jsonb_build_object('question','Completa','pieces',jsonb_build_array(
          jsonb_build_object('id','a','symbol','A','label','A'),jsonb_build_object('id','b','symbol','B','label','B'),
          jsonb_build_object('id','c','symbol','C','label','C'),jsonb_build_object('id','d','symbol','D','label','D')),
          'cells',jsonb_build_array('a','b','c','b','c','a','c','a',null),
          'optionIds',jsonb_build_array('d','a','b','c')),
        'solutionPayload',jsonb_build_object('correctOptionId','d'))
    )
  ))
$$, '22023', 'invalid_solution_payload', 'Rechaza una solución fuera de las opciones publicadas');

select ok(to_regclass('private.logic_matrix_attempt_events') is null,
  'F08 no crea una tabla de eventos específica');
select ok(to_regprocedure('private.submit_logic_matrix_answer(jsonb)') is null,
  'F08 no crea un comando específico');

select * from finish();
rollback;
