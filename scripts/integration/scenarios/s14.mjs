import { publishDraftQuestions } from "./publish-draft-questions.mjs";
import { dockerSql, rpc } from "../../support/supabase-local.mjs";

const document = {
  challenge: {
    slug: "survival-s14-integration",
    title: "Supervivencia S14 integración",
    subtitle: "Dos preguntas, una vida",
    description: "Contenido competitivo de Supervivencia publicado desde el portal.",
    mode: "survival",
    configSchemaVersion: 1,
    modeConfig: { lives: 1 },
  },
  questions: [
    {
      slug: "s14-integration-q1",
      type: "multiple-choice",
      payloadSchemaVersion: 1,
      timeLimitMs: 15000,
      points: 50,
      publicPayload: {
        category: "Cultura",
        tags: {},
        question: "¿Cuál es la capital de Portugal?",
        options: ["Lisboa", "Oporto"],
        media: null,
        promptVisual: null,
      },
      solutionPayload: {
        correctAnswer: "Lisboa",
        explanation: "Lisboa es la capital de Portugal.",
      },
    },
    {
      slug: "s14-integration-q2",
      type: "multiple-choice",
      payloadSchemaVersion: 1,
      timeLimitMs: 15000,
      points: 50,
      publicPayload: {
        category: "Ciencia",
        tags: {},
        question: "¿Qué planeta es conocido como el planeta rojo?",
        options: ["Marte", "Venus"],
        media: null,
        promptVisual: null,
      },
      solutionPayload: { correctAnswer: "Marte", explanation: "Marte es el planeta rojo." },
    },
  ],
};

export const scenario = {
  id: "s14",

  async run({ fixture, clients, config, assert }) {
    const initial = await clients.superadmin.rpc("get_superadmin_editorial_context");
    assert(
      !initial.error && Array.isArray(initial.data?.entries),
      "El portal editorial está disponible",
    );

    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: {
        idempotencyKey: "integration-s14-create",
        document,
        reason: "Preparar Supervivencia S14",
      },
    });
    assert(
      !created.error && created.data?.status === "draft",
      "El superadmin crea el borrador Survival",
    );
    assert(
      created.data?.questionCount === 2 && created.data?.document === null,
      "El borrador guarda dos preguntas y no devuelve soluciones",
    );

    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: document.questions.map((question) => question.slug),
      idempotencyKeyPrefix: "integration-s14-publish-question",
      reason: "Publicar pregunta S14",
      assert,
    });

    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-s14-publish",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: created.data.updatedAt,
        reason: "Publicar Supervivencia S14",
      },
    });
    assert(
      !published.error && published.data?.status === "published",
      "El superadmin publica el desafío de Supervivencia",
    );

    const scheduled = await clients.superadmin.rpc("create_superadmin_scheduled_challenge", {
      input: {
        idempotencyKey: "integration-s14-schedule",
        seasonId: fixture.data.seasonId,
        challengeVersionId: created.data.challengeVersionId,
        number: 1,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 3_600_000).toISOString(),
        reason: "Programar Supervivencia S14",
      },
    });
    assert(
      !scheduled.error && scheduled.data?.status === "scheduled",
      "El superadmin programa la publicación Survival",
    );

    await dockerSql(
      `set role service_role; select private.run_calendar_tick_command(jsonb_build_object('runId','integration-s14-tick'));`,
      config.dbContainer,
    );

    const calendar = await rpc(clients.member, "get_room_calendar", {
      target_room_slug: fixture.data.roomSlug,
    });
    const publication = calendar.find(
      (entry) => entry.publication_id === scheduled.data?.scheduledChallengeId,
    );
    assert(publication?.can_start === true, "El miembro ve la publicación abierta como jugable");

    const playable = await clients.member.rpc("get_my_survival_challenge", {
      target_room_slug: fixture.data.roomSlug,
      target_publication_id: scheduled.data.scheduledChallengeId,
    });
    assert(
      !playable.error && playable.data?.length === 2,
      "El miembro autorizado recibe las dos posiciones de Survival",
    );
    assert(
      playable.data?.every((row) => row.challenge_mode === "survival" && row.initial_lives === 1),
      "La proyección incluye modo y vidas iniciales congeladas",
    );
    assert(
      !JSON.stringify(playable.data).includes("correctAnswer"),
      "La proyección jugable no incluye soluciones",
    );

    const spectator = await rpc(clients.spectator, "get_room_calendar", {
      target_room_slug: fixture.data.roomSlug,
    });
    assert(
      spectator.some(
        (entry) =>
          entry.publication_id === scheduled.data?.scheduledChallengeId && !entry.can_start,
      ),
      "El espectador ve metadatos pero no puede iniciar Survival",
    );
    const spectatorProjection = await clients.spectator.rpc("get_my_survival_challenge", {
      target_room_slug: fixture.data.roomSlug,
      target_publication_id: scheduled.data.scheduledChallengeId,
    });
    assert(
      !spectatorProjection.error && spectatorProjection.data?.length === 0,
      "El espectador no recibe preguntas ni payload jugable",
    );

    const memberEditorial = await clients.member.rpc("get_superadmin_editorial_context");
    assert(
      Boolean(memberEditorial.error),
      "Un miembro no puede leer borradores ni soluciones del portal",
    );
  },
};

export default scenario;
