import { dockerSql, rpc, sqlCount } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "tabarnia",

  async run({ fixture, clients, config, assert }) {
    const [animals, bible, sbr, spain] = fixture.data.publications;
    assert(
      JSON.stringify(
        fixture.data.publications.map(({ title, mode, status }) => [title, mode, status]),
      ) ===
        JSON.stringify([
          ["Reino de animales", "alphabet", "open"],
          ["Biblia y religiones abrahámicas", "pyramid", "scheduled"],
          ["Steel Ball Run", "flash", "scheduled"],
          ["Supervivencia: España", "survival", "scheduled"],
        ]),
      "El manifiesto de Tabarnia conserva el orden de las cuatro publicaciones",
    );
    const playableAlphabet = await rpc(clients.ches, "get_my_alphabet_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: animals.id,
    });
    assert(playableAlphabet.length === 18, "Ches recibe las dieciocho letras de Reino de animales");
    assert(
      playableAlphabet.reduce((total, row) => total + Number(row.item_points), 0) === 100,
      "Reino de animales conserva los 100 puntos",
    );
    assert(
      playableAlphabet.map((row) => row.alphabet_letter).join(",") ===
        "A,B,C,D,E,F,G,H,I,J,L,M,O,P,R,S,T,Z",
      "Reino de animales conserva las letras y el orden editorial",
    );
    assert(
      !JSON.stringify(playableAlphabet).match(/correctAnswer|acceptedAnswers|solutionPayload/i),
      "La lectura jugable de Alphabet no expone soluciones",
    );

    const scheduledPyramid = await rpc(clients.ches, "get_my_pyramid_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: bible.id,
    });
    assert(scheduledPyramid.length === 0, "La Pirámide permanece programada tras Alphabet");

    const scheduledSpain = await rpc(clients.ches, "get_my_survival_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: spain.id,
    });
    assert(
      scheduledSpain.length === 0,
      "Supervivencia, programada al final, todavía no expone preguntas jugables",
    );
    const scheduledSbr = await rpc(clients.ches, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: sbr.id,
    });
    assert(
      scheduledSbr.length === 0,
      "Steel Ball Run programado todavía no expone preguntas jugables",
    );

    const publicationOrder = await dockerSql(
      `select string_agg(number::text || ':' || status, ',' order by number) from public.scheduled_challenges where season_id = '${fixture.data.seasonId}';`,
      config.dbContainer,
    );
    assert(
      publicationOrder.stdout.trim() === "1:open,2:scheduled,3:scheduled,4:scheduled",
      "Reino de animales está abierto; Pirámide, Steel Ball Run y Supervivencia quedan programados en orden",
    );
    for (const publication of [animals, spain, bible, sbr]) {
      const points = await dockerSql(
        `select coalesce(sum(points), 0) from private.challenge_items where challenge_version_id = '${publication.challengeVersionId}';`,
        config.dbContainer,
      );
      assert(Number(points.stdout.trim()) === 100, `${publication.title} suma 100 puntos`);
    }
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_items i join private.challenge_versions v on v.id = i.challenge_version_id where v.id = '${bible.challengeVersionId}' and v.mode = 'pyramid' and i.mode_config ? 'levelId';`,
        config.dbContainer,
      )) === 7,
      "La Pirámide publica siete niveles con briefing persistido",
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
      )) === 18,
      "Reino de animales persiste dieciocho items Alphabet con su letra",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_versions where id = '${animals.challengeVersionId}' and status = 'published' and mode = 'alphabet' and global_time_limit_ms = 135000;`,
        config.dbContainer,
      )) === 1,
      "Reino de animales persiste el límite global de 135 segundos",
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
    assert(!chesPreview?.avatarPath, "Ches conserva el fallback sin avatar");
    assert(
      (await sqlCount(
        "select count(*) from private.media_assets where bucket_id = 'avatars' and kind = 'avatar' and status = 'ready';",
        config.dbContainer,
      )) === 7,
      "Tabarnia tiene siete avatares listos en Storage",
    );
    assert(
      (await sqlCount(
        "select count(*) from public.players where display_name in ('xesmona', 'Ches', 'Carlos', 'Javi', 'Alejandro', 'Diego') and avatar_path is null;",
        config.dbContainer,
      )) === 6,
      "Los seis perfiles sin avatar conservan avatar_path nulo",
    );
    assert(
      (await sqlCount(
        "select count(*) from public.room_memberships rm join public.rooms r on r.id = rm.room_id where r.slug = 'tabarnia' and rm.status = 'active';",
        config.dbContainer,
      )) === 12,
      "Tabarnia tiene 12 jugadores activos",
    );
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "El seed no crea intentos históricos",
    );

    const superadminView = await rpc(clients.xesmona, "get_my_survival_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: spain.id,
    });
    assert(superadminView.length === 0, "xesmona queda fuera de la competición");
  },
};

export default scenario;
