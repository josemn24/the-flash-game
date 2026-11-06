-- Load after command-fixtures.sql. Keep this publication out of the shared catalog fixture.
insert into public.rooms(id,slug,title)
values(test_support.id('room-regrade'),'commands-regrade','Recálculo');
insert into public.room_memberships(room_id,player_id,role)
values(test_support.id('room-regrade'),test_support.id('owner'),'owner'),
  (test_support.id('room-regrade'),test_support.id('member'),'member');
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
values(test_support.id('season-regrade'),test_support.id('room-regrade'),'Recálculo','active',
  now()-interval '2 days',now()+interval '2 days');

insert into private.question_definitions(id,slug,created_by_player_id)
values(test_support.id('q-regrade'),'commands-q-regrade',test_support.id('superadmin'));
insert into private.question_versions(id,question_definition_id,version_number,type,time_limit_ms,public_payload,created_by_player_id)
values
  (test_support.id('qv-regrade-original'),test_support.id('q-regrade'),1,'progressive-image',25000,
    '{"category":"Geografía","question":"¿Qué paisaje aparece en la imagen?","tags":{"domains":["geography"],"topics":["landmarks"],"cognitiveSkills":["memory"],"formatSkills":["recall"],"lifeSkills":[]},"surface":{"src":"/visuals/sbr/grand-canyon-nps.jpg","alt":"Fotografía del Gran Cañón","width":1280,"height":853},"revealDurationMs":7000,"answerPlaceholder":null}'::jsonb,
    test_support.id('superadmin')),
  (test_support.id('qv-regrade-rubric'),test_support.id('q-regrade'),2,'progressive-image',25000,
    '{"category":"Geografía","question":"¿Qué paisaje aparece en la imagen?","tags":{"domains":["geography"],"topics":["landmarks"],"cognitiveSkills":["memory"],"formatSkills":["recall"],"lifeSkills":[]},"surface":{"src":"/visuals/sbr/grand-canyon-nps.jpg","alt":"Fotografía de un paisaje rocoso","width":1280,"height":853},"revealDurationMs":7000,"answerPlaceholder":null}'::jsonb,
    test_support.id('superadmin')),
  (test_support.id('qv-regrade-draft'),test_support.id('q-regrade'),3,'progressive-image',25000,
    '{"category":"Geografía","question":"¿Qué paisaje aparece en la imagen?","tags":{"domains":["geography"],"topics":["landmarks"],"cognitiveSkills":["memory"],"formatSkills":["recall"],"lifeSkills":[]},"surface":{"src":"/visuals/sbr/grand-canyon-nps.jpg","alt":"Fotografía de un paisaje rocoso","width":1280,"height":853},"revealDurationMs":7000,"answerPlaceholder":null}'::jsonb,
    test_support.id('superadmin')),
  (test_support.id('qv-regrade-other-format'),test_support.id('q-regrade'),4,'short-text',25000,
    '{"category":"Geografía","question":"¿Qué paisaje aparece en la imagen?","tags":{"domains":["geography"],"topics":["landmarks"],"cognitiveSkills":["memory"],"formatSkills":["recall"],"lifeSkills":[]},"answerPlaceholder":null}'::jsonb,
    test_support.id('superadmin'));

insert into private.question_version_solutions(question_version_id,solution_payload)
values
  (test_support.id('qv-regrade-original'),
    '{"correctAnswer":"Gran Cañón","acceptedAnswers":["Gran Cañón"],"solutionAlt":"Fotografía del Gran Cañón"}'),
  (test_support.id('qv-regrade-rubric'),
    '{"correctAnswer":"Gran Cañón","acceptedAnswers":["Gran Cañón","Cañón"],"solutionAlt":"Fotografía del Gran Cañón"}'),
  (test_support.id('qv-regrade-draft'),
    '{"correctAnswer":"Gran Cañón","acceptedAnswers":["Gran Cañón","Cañón"],"solutionAlt":"Fotografía del Gran Cañón"}'),
  (test_support.id('qv-regrade-other-format'),
    '{"correctAnswer":"Gran Cañón","acceptedAnswers":["Gran Cañón","Cañón"]}');
update private.question_versions set status='published'
where question_definition_id = test_support.id('q-regrade') and id <> test_support.id('qv-regrade-draft');

insert into private.challenge_definitions(id,slug,created_by_player_id)
values(test_support.id('cd-regrade'),'commands-cd-regrade',test_support.id('superadmin'));
insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,created_by_player_id,mode_config)
values(test_support.id('cv-regrade'),test_support.id('cd-regrade'),1,'flash','Recálculo por pregunta',test_support.id('superadmin'),'{}'::jsonb);
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points,mode_config)
values(test_support.id('item-regrade'),test_support.id('cv-regrade'),test_support.id('qv-regrade-original'),1,100,'{}'::jsonb);
update private.challenge_versions set status='published' where id=test_support.id('cv-regrade');

insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
values(test_support.id('sc-regrade'),test_support.id('season-regrade'),test_support.id('cv-regrade'),1,
  'open',now()-interval '1 day',now()+interval '1 day');
