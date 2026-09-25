begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

select lives_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object(
      'slug','f01-final-answer','title','Formatos finales','subtitle','F01/F02/F06',
      'description','Validación de formatos de respuesta final','mode','flash',
      'configSchemaVersion',1,'modeConfig','{}'::jsonb
    ),
    'questions', jsonb_build_array(
      jsonb_build_object(
        'slug','sbr-overtake-second-trap','type','true-false','payloadSchemaVersion',1,
        'timeLimitMs',12000,'points',20,
        'publicPayload',jsonb_build_object('category','Lógica','tags','{}'::jsonb,
          'question','En una carrera, adelantar al segundo te coloca primero.'),
        'solutionPayload',jsonb_build_object('correctAnswer',false,'explanation','Te coloca segundo.')
      ),
      jsonb_build_object(
        'slug','sbr-horses-sleep-standing','type','true-false','payloadSchemaVersion',1,
        'timeLimitMs',14000,'points',20,
        'publicPayload',jsonb_build_object('category','Ciencias naturales','tags','{}'::jsonb,
          'question','Los caballos pueden dormir de pie.'),
        'solutionPayload',jsonb_build_object('correctAnswer',true,'explanation','Pueden descansar de pie.')
      ),
      jsonb_build_object(
        'slug','sbr-equidae-odd-one-out','type','odd-one-out','payloadSchemaVersion',1,
        'timeLimitMs',14000,'points',20,
        'publicPayload',jsonb_build_object('category','Ciencias naturales','tags','{}'::jsonb,
          'question','¿Cuál no pertenece a los équidos?','items',jsonb_build_array(
            jsonb_build_object('id','horse','label','Caballo'),
            jsonb_build_object('id','zebra','label','Cebra'),
            jsonb_build_object('id','donkey','label','Burro'),
            jsonb_build_object('id','bison','label','Bisonte'))),
        'solutionPayload',jsonb_build_object('correctAnswer','bison','explanation','Es un bóvido.')
      ),
      jsonb_build_object(
        'slug','sbr-west-to-east-cities','type','ordering','payloadSchemaVersion',1,
        'timeLimitMs',26000,'points',20,
        'publicPayload',jsonb_build_object('category','Geografía','tags','{}'::jsonb,
          'question','Ordena las ciudades de oeste a este.','items',jsonb_build_array('Nueva York','Denver','San Diego','Chicago'),
          'directionLabels',jsonb_build_object('start','Más al oeste','end','Más al este')),
        'solutionPayload',jsonb_build_object('correctOrder',jsonb_build_array('San Diego','Denver','Chicago','Nueva York'),
          'explanation','Orden geográfico.')
      ),
      jsonb_build_object(
        'slug','sbr-horse-gaits','type','ordering','payloadSchemaVersion',1,
        'timeLimitMs',20000,'points',20,
        'publicPayload',jsonb_build_object('category','Deporte','tags','{}'::jsonb,
          'question','Ordena estos movimientos del caballo de menor a mayor velocidad.',
          'items',jsonb_build_array('Galope','Paso','Trote'),
          'directionLabels',jsonb_build_object('start','Más lento','end','Más rápido')),
        'solutionPayload',jsonb_build_object('correctOrder',jsonb_build_array('Paso','Trote','Galope'),
          'explanation','Paso, trote y galope.')
      )
    )
  ))
$$, 'El validador acepta el desafío mixto de Steel Ball Run');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object('slug','invalid-bool','title','Inválido','subtitle','','description','','mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb),
    'questions', jsonb_build_array(
      jsonb_build_object(
        'slug','invalid-bool','type','true-false','payloadSchemaVersion',1,'timeLimitMs',12000,'points',50,
        'publicPayload',jsonb_build_object('question','¿Es correcto?'),
        'solutionPayload',jsonb_build_object('correctAnswer','false')
      ),
      jsonb_build_object(
        'slug','valid-bool','type','true-false','payloadSchemaVersion',1,'timeLimitMs',12000,'points',50,
        'publicPayload',jsonb_build_object('question','¿Es correcto?'),
        'solutionPayload',jsonb_build_object('correctAnswer',false)
      )
    )
  ))
$$, '22023', 'invalid_solution_payload', 'Rechaza strings en true-false');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object('slug','invalid-order','title','Inválido','subtitle','','description','','mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb),
    'questions', jsonb_build_array(
      jsonb_build_object(
        'slug','invalid-order','type','ordering','payloadSchemaVersion',1,'timeLimitMs',12000,'points',50,
        'publicPayload',jsonb_build_object('question','Ordena','items',jsonb_build_array('A','B','C')),
        'solutionPayload',jsonb_build_object('correctOrder',jsonb_build_array('A','A','B'))
      ),
      jsonb_build_object(
        'slug','valid-order','type','ordering','payloadSchemaVersion',1,'timeLimitMs',12000,'points',50,
        'publicPayload',jsonb_build_object('question','Ordena','items',jsonb_build_array('A','B')),
        'solutionPayload',jsonb_build_object('correctOrder',jsonb_build_array('A','B'))
      )
    )
  ))
$$, '22023', 'invalid_solution_payload', 'Rechaza órdenes incompletos o duplicados');

select * from finish();
rollback;
