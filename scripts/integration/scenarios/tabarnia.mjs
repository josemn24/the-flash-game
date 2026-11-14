import { dockerSql, rpc, sqlCount } from "../../support/supabase-local.mjs";
import { TABARNIA_FICTION_ALPHABET } from "../../fixtures/scenarios/tabarnia-multiverse.mjs";

export const scenario = {
  id: "tabarnia",

  async run({ fixture, clients, config, assert }) {
    const [
      sbr,
      animals,
      queensTimeTrial,
      spain,
      logicPyramid,
      multiverse,
      connectPairsTimeTrial,
      bible,
      tabarniaverso,
    ] = fixture.data.publications;
    assert(
      JSON.stringify(
        fixture.data.publications.map(({ title, mode, status }) => [title, mode, status]),
      ) ===
        JSON.stringify([
          ["Steel Ball Run", "flash", "open"],
          ["Reino de animales", "alphabet", "scheduled"],
          ["Queens", "time-trial", "scheduled"],
          ["España", "survival", "scheduled"],
          ["Cumbre lógica", "pyramid", "scheduled"],
          ["Multiverso friki", "alphabet", "scheduled"],
          ["Flow Free", "time-trial", "scheduled"],
          ["La Biblia", "pyramid", "scheduled"],
          ["Tabarniaverso", "flash", "scheduled"],
        ]),
      "El manifiesto de Tabarnia conserva el orden de las nueve publicaciones",
    );
    const playableFlash = await rpc(clients.ches, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: sbr.id,
    });
    assert(playableFlash.length === 16, "Ches recibe los dieciséis retos de Steel Ball Run");
    assert(
      playableFlash.reduce((total, row) => total + Number(row.item_points), 0) === 100,
      "Steel Ball Run conserva los 100 puntos",
    );
    assert(
      !JSON.stringify(playableFlash).match(/correctAnswer|solutionPayload/i),
      "La lectura jugable de Steel Ball Run no expone soluciones",
    );
    const scheduledAlphabet = await rpc(clients.ches, "get_my_alphabet_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: animals.id,
    });
    assert(
      scheduledAlphabet.length === 0,
      "Reino de animales permanece programado después de Steel Ball Run",
    );

    const scheduledPyramid = await rpc(clients.ches, "get_my_pyramid_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: bible.id,
    });
    assert(scheduledPyramid.length === 0, "La Pirámide bíblica permanece programada");
    const scheduledFlash = await rpc(clients.ches, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: tabarniaverso.id,
    });
    assert(scheduledFlash.length === 0, "Tabarniaverso aún no expone preguntas jugables");
    const scheduledLogicPyramid = await rpc(clients.ches, "get_my_pyramid_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: logicPyramid.id,
    });
    assert(
      scheduledLogicPyramid.length === 0,
      "Cumbre lógica permanece programada y aún no expone preguntas jugables",
    );
    const scheduledQueensTimeTrial = await rpc(clients.ches, "get_my_time_trial_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: queensTimeTrial.id,
    });
    assert(
      scheduledQueensTimeTrial.length === 0,
      "Queens permanece programado y aún no expone tableros jugables",
    );
    const scheduledConnectPairsTimeTrial = await rpc(clients.ches, "get_my_time_trial_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: connectPairsTimeTrial.id,
    });
    assert(
      scheduledConnectPairsTimeTrial.length === 0,
      "Flow Free permanece programado y aún no expone tableros jugables",
    );

    const scheduledSpain = await rpc(clients.ches, "get_my_survival_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: spain.id,
    });
    assert(
      scheduledSpain.length === 0,
      "España permanece programada en la cuarta publicación y no expone preguntas jugables",
    );
    const scheduledMultiverse = await rpc(clients.ches, "get_my_alphabet_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: multiverse.id,
    });
    assert(
      scheduledMultiverse.length === 0,
      "El Alphabet de ficción programado todavía no expone preguntas jugables",
    );

    const publicationOrder = await dockerSql(
      `select string_agg(number::text || ':' || status, ',' order by number) from public.scheduled_challenges where season_id = '${fixture.data.seasonId}';`,
      config.dbContainer,
    );
    assert(
      publicationOrder.stdout.trim() ===
        "1:open,2:scheduled,3:scheduled,4:scheduled,5:scheduled,6:scheduled,7:scheduled,8:scheduled,9:scheduled",
      "Steel Ball Run está abierto y los ocho desafíos siguientes quedan programados en orden",
    );
    for (const publication of [
      sbr,
      animals,
      queensTimeTrial,
      spain,
      logicPyramid,
      multiverse,
      connectPairsTimeTrial,
      bible,
      tabarniaverso,
    ]) {
      const points = await dockerSql(
        `select coalesce(sum(points), 0) from private.challenge_items where challenge_version_id = '${publication.challengeVersionId}';`,
        config.dbContainer,
      );
      assert(Number(points.stdout.trim()) === 100, `${publication.title} suma 100 puntos`);
    }
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_items i join private.challenge_versions v on v.id = i.challenge_version_id join private.question_versions q on q.id = i.question_version_id where v.id = '${queensTimeTrial.challengeVersionId}' and v.mode = 'time-trial' and v.global_time_limit_ms = 150000 and q.type = 'queens';`,
        config.dbContainer,
      )) === 7,
      "Queens publica siete tableros con reloj global de 150 segundos",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_items i join private.challenge_versions v on v.id = i.challenge_version_id join private.question_versions q on q.id = i.question_version_id where v.id = '${connectPairsTimeTrial.challengeVersionId}' and v.mode = 'time-trial' and v.global_time_limit_ms = 150000 and q.type = 'connect-pairs';`,
        config.dbContainer,
      )) === 9,
      "Flow Free publica nueve tableros con reloj global de 150 segundos",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_items i join private.challenge_versions v on v.id = i.challenge_version_id where v.id = '${bible.challengeVersionId}' and v.mode = 'pyramid' and i.mode_config ? 'levelId';`,
        config.dbContainer,
      )) === 7,
      "La Pirámide publica siete niveles con briefing persistido",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_items i join private.challenge_versions v on v.id = i.challenge_version_id where v.id = '${logicPyramid.challengeVersionId}' and v.mode = 'pyramid' and i.mode_config ? 'levelId';`,
        config.dbContainer,
      )) === 7,
      "Cumbre lógica publica siete niveles con briefing persistido",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.question_versions q join private.challenge_items i on i.question_version_id = q.id where i.challenge_version_id = '${bible.challengeVersionId}' and q.type = 'mini-wordle' and q.public_payload->>'wordLength' = '5';`,
        config.dbContainer,
      )) === 1,
      "La Pirámide incluye Mini-Wordle de cinco letras",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_items i join private.challenge_versions v on v.id = i.challenge_version_id join private.question_versions q on q.id = i.question_version_id where v.id = '${animals.challengeVersionId}' and v.mode = 'alphabet' and q.type = 'short-text' and i.mode_config ? 'letter';`,
        config.dbContainer,
      )) === 16,
      "Reino de animales persiste dieciséis items Alphabet con su letra",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_versions where id = '${animals.challengeVersionId}' and status = 'published' and mode = 'alphabet' and global_time_limit_ms = 150000;`,
        config.dbContainer,
      )) === 1,
      "Reino de animales persiste el límite global de 150 segundos",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_items i join private.challenge_versions v on v.id = i.challenge_version_id join private.question_versions q on q.id = i.question_version_id where v.id = '${multiverse.challengeVersionId}' and v.status = 'published' and v.mode = 'alphabet' and v.global_time_limit_ms = 150000 and q.type = 'short-text' and q.time_limit_ms = 120000 and i.mode_config ? 'letter';`,
        config.dbContainer,
      )) === 16,
      "El Alphabet de ficción publica dieciséis letras con límites de 150 y 120 segundos",
    );
    const fictionPoints = await dockerSql(
      `select string_agg(i.points::text, ',' order by i.position) from private.challenge_items i where i.challenge_version_id = '${multiverse.challengeVersionId}';`,
      config.dbContainer,
    );
    assert(
      fictionPoints.stdout.trim() === [7, 7, 7, 7, ...Array(12).fill(6)].join(","),
      "El Alphabet de ficción asigna siete puntos a las primeras cuatro letras y seis al resto",
    );
    assert(
      (await sqlCount(
        "select count(*) from private.mini_wordle_dictionary_words where dictionary_id = 'es-general-5.v1';",
        config.dbContainer,
      )) > 0,
      "El diccionario Mini-Wordle de cinco letras está cargado tras el reset",
    );
    assert(
      (await sqlCount(
        "select count(*) from private.media_assets where bucket_id = 'question-assets' and kind = 'question-asset' and status = 'ready';",
        config.dbContainer,
      )) === 4,
      "Los mapas privados de Tabarnia y las imágenes de España están listos",
    );
    const roomCards = await rpc(clients.ches, "get_my_room_cards", {});
    const memberPreviews = roomCards[0]?.member_previews ?? [];
    const darkPreview = memberPreviews.find((preview) => preview.name === "Dark");
    const jacoboPreview = memberPreviews.find((preview) => preview.name === "Jacobo");
    const chesPreview = memberPreviews.find((preview) => preview.name === "Ches");
    assert(darkPreview?.avatarPath?.startsWith("avatars/"), "Dark tiene avatar en Storage");
    assert(jacoboPreview?.avatarPath?.startsWith("avatars/"), "Jacobo tiene avatar en Storage");
    assert(chesPreview?.avatarPath?.startsWith("avatars/"), "Ches tiene avatar en Storage");
    assert(
      (await sqlCount(
        "select count(*) from private.media_assets where bucket_id = 'avatars' and kind = 'avatar' and status = 'ready';",
        config.dbContainer,
      )) === 15,
      "Tabarnia tiene quince avatares listos en Storage",
    );
    assert(
      (await sqlCount(
        "select count(*) from public.players where display_name = 'xesmona' and avatar_path is null;",
        config.dbContainer,
      )) === 1,
      "El superadmin conserva el fallback sin avatar",
    );
    assert(
      (await sqlCount(
        "select count(*) from public.room_memberships rm join public.rooms r on r.id = rm.room_id where r.slug = 'tabarnia' and rm.status = 'active';",
        config.dbContainer,
      )) === 15,
      "Tabarnia tiene 15 jugadores activos",
    );
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "El seed no crea intentos históricos",
    );

    const timeoutCheck = await dockerSql(
      `
begin;
update public.scheduled_challenges
set status = 'cancelled', cancelled_at = clock_timestamp()
where season_id = '${fixture.data.seasonId}' and id <> '${animals.id}' and status <> 'cancelled';
update public.scheduled_challenges
set status = 'open', cancelled_at = null,
    opens_at = clock_timestamp() + interval '200 milliseconds',
    closes_at = clock_timestamp() + interval '1 hour'
where id = '${animals.id}';
select pg_sleep(0.3);
do $$
declare
  auth_user uuid;
  token text := 'integration-tabarnia-timeout-token';
  started jsonb;
  prepared jsonb;
  received jsonb;
  evaluated jsonb;
  completed jsonb;
  v_attempt_id uuid;
  current_item uuid;
  current_points integer;
  lock_version bigint;
  item_count integer;
  item_index integer;
  final_status text;
  final_answer_count integer;
  final_timeout_count integer;
  preserved_points integer;
  final_score integer;
begin
  select auth_user_id into auth_user from public.players where id = '${fixture.users.ches.playerId}';
  perform set_config('request.jwt.claim.sub', auth_user::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', auth_user::text, 'role', 'authenticated', 'is_anonymous', false)::text,
    true
  );
  started := private.execute_command('start', jsonb_build_object(
    'idempotencyKey', 'integration-tabarnia-timeout-start',
    'scheduledChallengeId', '${animals.id}'::uuid,
    'sessionToken', token
  ));
  v_attempt_id := (started->>'attemptId')::uuid;
  lock_version := (started->>'lockVersion')::bigint;

  prepared := private.execute_command('prepare', jsonb_build_object(
    'idempotencyKey', 'integration-tabarnia-timeout-first-prepare',
    'attemptId', v_attempt_id,
    'lockVersion', lock_version,
    'sessionToken', token
  ));
  if (prepared->>'timedOut')::boolean or prepared->'publicPayload' = 'null'::jsonb then
    raise exception 'The initial Alphabet item should be playable before its deadline';
  end if;
  current_item := (prepared->>'challengeItemId')::uuid;
  select points into current_points from private.challenge_items where id = current_item;
  received := private.execute_command('receive', jsonb_build_object(
    'idempotencyKey', 'integration-tabarnia-timeout-first-answer',
    'attemptId', v_attempt_id,
    'lockVersion', (prepared->>'lockVersion')::bigint,
    'sessionToken', token,
    'challengeItemId', current_item,
    'answer', to_jsonb('armadillo'::text)
  ));
  evaluated := private.execute_command('evaluate', jsonb_build_object(
    'idempotencyKey', 'integration-tabarnia-timeout-first-evaluation',
    'attemptId', v_attempt_id,
    'lockVersion', (received->>'lockVersion')::bigint,
    'sessionToken', token,
    'receiptId', received->>'receiptId',
    'status', 'correct',
    'points', current_points
  ));

  execute 'alter table public.attempts disable trigger attempts_guard';
  update public.attempts
  set started_at = clock_timestamp() - interval '136 seconds',
      deadline_at = clock_timestamp() - interval '1 second'
  where id = v_attempt_id;
  execute 'alter table public.attempts enable trigger attempts_guard';

  select count(*) into item_count from private.challenge_items
  where challenge_version_id = (select challenge_version_id from public.attempts where id = v_attempt_id);
  lock_version := (evaluated->>'lockVersion')::bigint;
  for item_index in 2..item_count loop
    prepared := private.execute_command('prepare', jsonb_build_object(
      'idempotencyKey', 'integration-tabarnia-timeout-prepare-' || item_index,
      'attemptId', v_attempt_id,
      'lockVersion', lock_version,
      'sessionToken', token
    ));
    if (prepared->>'timedOut')::boolean is distinct from true
      or prepared->'publicPayload' is distinct from 'null'::jsonb then
      raise exception 'Expired Alphabet items must be returned as timed out without a public payload';
    end if;
    current_item := (prepared->>'challengeItemId')::uuid;
    received := private.execute_command('receive', jsonb_build_object(
      'idempotencyKey', 'integration-tabarnia-timeout-answer-' || item_index,
      'attemptId', v_attempt_id,
      'lockVersion', (prepared->>'lockVersion')::bigint,
      'sessionToken', token,
      'challengeItemId', current_item,
      'answer', null
    ));
    if (received->>'timedOut')::boolean is distinct from true then
      raise exception 'The server must mark a post-deadline answer as timed out';
    end if;
    evaluated := private.execute_command('evaluate', jsonb_build_object(
      'idempotencyKey', 'integration-tabarnia-timeout-evaluation-' || item_index,
      'attemptId', v_attempt_id,
      'lockVersion', (received->>'lockVersion')::bigint,
      'sessionToken', token,
      'receiptId', received->>'receiptId',
      'status', 'timeout',
      'points', 0
    ));
    lock_version := (evaluated->>'lockVersion')::bigint;
  end loop;

  completed := private.execute_command('complete', jsonb_build_object(
    'idempotencyKey', 'integration-tabarnia-timeout-complete',
    'attemptId', v_attempt_id,
    'lockVersion', lock_version,
    'sessionToken', token
  ));
  select a.status, count(answer.*), count(*) filter (where answer.status = 'timeout'),
    max(answer.points) filter (where answer.status = 'correct'), a.score
  into final_status, final_answer_count, final_timeout_count, preserved_points, final_score
  from public.attempts a
  join private.attempt_answers answer on answer.attempt_id = a.id
  where a.id = v_attempt_id
  group by a.status, a.score;
  if final_status <> 'completed' or final_answer_count <> item_count
    or final_timeout_count <> item_count - 1 or preserved_points <> current_points
    or final_score <> current_points or completed->>'status' <> 'completed' then
    raise exception 'Unexpected Alphabet timeout finalization: %, %, %, %, %',
      final_status, final_answer_count, final_timeout_count, preserved_points, final_score;
  end if;
end;
$$;
select 'timeout-finalization-ok';
rollback;
`,
      config.dbContainer,
    );
    assert(
      timeoutCheck.stdout.trim() === "timeout-finalization-ok",
      "Alphabet guarda el timeout, conserva la respuesta previa y completa todas las letras tras vencer el plazo",
    );
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La verificación de timeout revierte el intento de prueba y no deja historial",
    );

    const superadminView = await rpc(clients.xesmona, "get_my_survival_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: spain.id,
    });
    assert(superadminView.length === 0, "xesmona queda fuera de la competición");

    await dockerSql(
      `
begin;
update public.scheduled_challenges
set status = 'cancelled', cancelled_at = clock_timestamp()
where season_id = '${fixture.data.seasonId}' and id <> '${multiverse.id}' and status <> 'cancelled';
update public.scheduled_challenges
set opens_at = clock_timestamp() + interval '200 milliseconds',
    closes_at = clock_timestamp() + interval '5 minutes'
where id = '${multiverse.id}';
select pg_sleep(0.3);
set local role service_role;
select private.run_calendar_tick_command('{"runId":"integration-tabarnia-multiverse-open"}'::jsonb);
commit;
`,
      config.dbContainer,
    );
    const playableMultiverse = await rpc(clients.ches, "get_my_alphabet_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: multiverse.id,
    });
    assert(playableMultiverse.length === 16, "Ches recibe las dieciséis letras del nuevo Alphabet");
    assert(
      playableMultiverse.reduce((total, row) => total + Number(row.item_points), 0) === 100,
      "El nuevo Alphabet conserva los 100 puntos",
    );
    assert(
      playableMultiverse.map((row) => row.alphabet_letter).join(",") ===
        "A,B,C,D,E,F,I,J,L,M,O,P,R,S,T,Z",
      "El nuevo Alphabet conserva sus letras y el orden editorial",
    );
    const serializedMultiverse = JSON.stringify(playableMultiverse);
    assert(
      !/correctAnswer|acceptedAnswers|solutionPayload/i.test(serializedMultiverse) &&
        TABARNIA_FICTION_ALPHABET.entries.every(
          (entry) => !serializedMultiverse.includes(entry.correctAnswer),
        ),
      "La lectura jugable del nuevo Alphabet no expone claves ni respuestas",
    );
  },
};

export default scenario;
