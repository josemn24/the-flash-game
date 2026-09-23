import { publishDraftQuestions } from "./publish-draft-questions.mjs";
import { dockerSql, rpc } from "../../support/supabase-local.mjs";

const questions = Array.from({ length: 7 }, (_, index) => ({
  slug: `s15-integration-q${index + 1}`,
  type: "multiple-choice",
  payloadSchemaVersion: 1,
  timeLimitMs: 15000,
  points: index < 5 ? 14 : 15,
  publicPayload: {
    category: "Lógica",
    tags: {},
    question: `S15 nivel ${index + 1}: ¿qué color se mezcla con azul para formar violeta?`,
    options: ["Rojo", "Verde"],
    media: null,
    promptVisual: null,
  },
  solutionPayload: {
    correctAnswer: "Rojo",
    explanation: "El rojo mezclado con azul forma violeta.",
  },
  modeConfig: {
    levelId: `level-${index + 1}`,
    label: `Nivel ${index + 1}`,
    briefing: {
      title: `Briefing ${index + 1}`,
      format: "Lógica",
      description: `Resuelve la prueba del nivel ${index + 1} para seguir ascendiendo.`,
    },
  },
}));

const document = {
  challenge: {
    slug: "pyramid-s15-integration",
    title: "La Pirámide S15 integración",
    subtitle: "Siete niveles persistidos",
    description: "Contenido competitivo de La Pirámide publicado desde el portal.",
    mode: "pyramid",
    configSchemaVersion: 1,
    modeConfig: {},
  },
  questions,
};

export const scenario = {
  id: "s15",

  async run({ fixture, clients, config, assert }) {
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: {
        idempotencyKey: "integration-s15-create",
        document,
        reason: "Preparar La Pirámide S15",
      },
    });
    assert(
      !created.error && created.data?.status === "draft" && created.data?.questionCount === 7,
      "El superadmin crea un borrador de siete niveles",
    );

    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: questions.map((question) => question.slug),
      idempotencyKeyPrefix: "integration-s15-publish-question",
      reason: "Publicar pregunta S15",
      assert,
    });

    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-s15-publish",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: created.data.updatedAt,
        reason: "Publicar La Pirámide S15",
      },
    });
    assert(
      !published.error && published.data?.status === "published",
      "El superadmin publica los siete niveles",
    );

    const scheduled = await clients.superadmin.rpc("create_superadmin_scheduled_challenge", {
      input: {
        idempotencyKey: "integration-s15-schedule",
        seasonId: fixture.data.seasonId,
        challengeVersionId: created.data.challengeVersionId,
        number: 1,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 3_600_000).toISOString(),
        reason: "Programar La Pirámide S15",
      },
    });
    assert(
      !scheduled.error && scheduled.data?.status === "scheduled",
      "El superadmin programa La Pirámide",
    );

    await dockerSql(
      `set role service_role; select private.run_calendar_tick_command(jsonb_build_object('runId','integration-s15-tick'));`,
      config.dbContainer,
    );

    const calendar = await rpc(clients.member, "get_room_calendar", {
      target_room_slug: fixture.data.roomSlug,
    });
    const publication = calendar.find(
      (entry) => entry.publication_id === scheduled.data?.scheduledChallengeId,
    );
    assert(publication?.can_start === true, "El miembro ve los siete niveles como jugables");

    const playable = await clients.member.rpc("get_my_pyramid_challenge", {
      target_room_slug: fixture.data.roomSlug,
      target_publication_id: scheduled.data.scheduledChallengeId,
    });
    assert(
      !playable.error && playable.data?.length === 7,
      "El miembro recibe siete posiciones de nivel",
    );
    assert(
      playable.data?.every(
        (row, index) =>
          row.challenge_mode === "pyramid" &&
          row.item_position === index + 1 &&
          row.level_id === `level-${index + 1}` &&
          row.briefing_title === `Briefing ${index + 1}`,
      ),
      "La proyección ordena levelId y briefings sin enviar preguntas ni soluciones",
    );
    assert(
      !JSON.stringify(playable.data).includes("S15 nivel") &&
        !JSON.stringify(playable.data).includes("correctAnswer"),
      "La lectura de juego solo expone la metadata de niveles",
    );

    const spectator = await clients.spectator.rpc("get_my_pyramid_challenge", {
      target_room_slug: fixture.data.roomSlug,
      target_publication_id: scheduled.data.scheduledChallengeId,
    });
    assert(
      !spectator.error && spectator.data?.length === 0,
      "El spectator no recibe contenido jugable",
    );
    const memberEditorial = await clients.member.rpc("get_superadmin_editorial_context");
    assert(Boolean(memberEditorial.error), "Un miembro no puede acceder al editor de desafíos");
  },
};

export default scenario;
