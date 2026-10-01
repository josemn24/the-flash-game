import { publishDraftQuestions } from "./publish-draft-questions.mjs";
import { dockerSql, rpc } from "../../support/supabase-local.mjs";

const document = {
  challenge: {
    slug: "flash-s17-integration",
    title: "Flash S17 integración",
    subtitle: "Versión inicial",
    description: "Contenido editorial para comprobar correcciones versionadas.",
    mode: "flash",
    configSchemaVersion: 1,
    modeConfig: {},
  },
  questions: [1, 2].map((index) => ({
    slug: `s17-integration-question-${index}`,
    type: "multiple-choice",
    payloadSchemaVersion: 1,
    timeLimitMs: 15000,
    points: 50,
    publicPayload: {
      category: "S17",
      tags: {},
      question: `¿Pregunta S17 ${index}?`,
      options: ["A", "B"],
      media: null,
      promptVisual: null,
    },
    solutionPayload: { correctAnswer: "A", explanation: `Respuesta S17 ${index}.` },
  })),
};

export const scenario = {
  id: "s17",

  async run({ fixture, clients, config, assert }) {
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: {
        idempotencyKey: "integration-s17-create-1",
        document,
        reason: "Preparar contenido S17",
      },
    });
    assert(!created.error && created.data?.status === "draft", "S17 crea el desafío inicial");

    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: document.questions.map((question) => question.slug),
      idempotencyKeyPrefix: "integration-s17-publish-question",
      reason: "Publicar preguntas S17",
      assert,
    });
    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-s17-publish-1",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: created.data.updatedAt,
        reason: "Publicar contenido inicial S17",
      },
    });
    assert(
      !published.error && published.data?.status === "published",
      "S17 publica la versión inicial",
    );

    const revision = await clients.superadmin.rpc("create_superadmin_challenge_revision", {
      input: {
        idempotencyKey: "integration-s17-revision-1",
        sourceChallengeVersionId: created.data.challengeVersionId,
        reason: "Crear corrección S17",
      },
    });
    assert(
      !revision.error && revision.data?.status === "draft",
      "S17 crea una corrección como borrador",
    );
    assert(revision.data?.versionNumber === 2, "La corrección S17 recibe la versión secuencial 2");

    const draftContext = await clients.superadmin.rpc("get_superadmin_challenge_detail", {
      target_challenge_definition_id: created.data.challengeDefinitionId,
    });
    const clonedDraft = draftContext.data?.entries?.find(
      (entry) => entry.challengeVersionId === revision.data.challengeVersionId,
    );
    assert(
      clonedDraft?.document?.questions?.every((question) => question.source === "library"),
      "El borrador clonado representa preguntas publicadas como referencias de biblioteca",
    );
    assert(
      !JSON.stringify(clonedDraft).includes("solutionPayload"),
      "La lectura del borrador clonado no entrega soluciones privadas inline",
    );

    const updatedDocument = {
      ...clonedDraft.document,
      challenge: { ...clonedDraft.document.challenge, title: "Flash S17 corregido" },
    };
    const updated = await clients.superadmin.rpc("update_superadmin_flash_draft", {
      input: {
        idempotencyKey: "integration-s17-update-1",
        challengeVersionId: revision.data.challengeVersionId,
        expectedUpdatedAt: revision.data.updatedAt,
        document: updatedDocument,
        reason: "Corregir título S17",
      },
    });
    assert(
      !updated.error && updated.data?.title === "Flash S17 corregido",
      "S17 actualiza el borrador clonado",
    );

    const republished = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-s17-publish-2",
        challengeVersionId: revision.data.challengeVersionId,
        expectedUpdatedAt: updated.data.updatedAt,
        reason: "Publicar corrección S17",
      },
    });
    assert(
      !republished.error && republished.data?.status === "published",
      "S17 publica la corrección",
    );

    const initialSchedule = await clients.superadmin.rpc("create_superadmin_scheduled_challenge", {
      input: {
        idempotencyKey: "integration-s17-schedule-1",
        seasonId: fixture.data.seasonId,
        challengeVersionId: created.data.challengeVersionId,
        number: 1,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 3_600_000).toISOString(),
        reason: "Programar versión inicial S17",
      },
    });
    const correctedSchedule = await clients.superadmin.rpc(
      "create_superadmin_scheduled_challenge",
      {
        input: {
          idempotencyKey: "integration-s17-schedule-2",
          seasonId: fixture.data.seasonId,
          challengeVersionId: revision.data.challengeVersionId,
          number: 2,
          opensAt: new Date(Date.now() + 86_400_000).toISOString(),
          closesAt: new Date(Date.now() + 90_000_000).toISOString(),
          reason: "Programar corrección S17",
        },
      },
    );
    assert(
      !initialSchedule.error && !correctedSchedule.error,
      "S17 programa dos versiones distintas",
    );

    const archived = await clients.superadmin.rpc("archive_superadmin_challenge_version", {
      input: {
        idempotencyKey: "integration-s17-archive-1",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: published.data.updatedAt,
        reason: "Archivar versión inicial S17",
      },
    });
    assert(
      !archived.error && archived.data?.status === "archived",
      "S17 archiva solo la versión inicial",
    );

    const comparison = await clients.superadmin.rpc("get_superadmin_challenge_version_comparison", {
      from_challenge_version_id: created.data.challengeVersionId,
      to_challenge_version_id: revision.data.challengeVersionId,
    });
    assert(
      !comparison.error && comparison.data?.from?.status === "archived",
      "La comparación incluye la versión archivada",
    );
    assert(
      !JSON.stringify(comparison.data).includes("solutionPayload"),
      "La comparación no expone soluciones",
    );

    await dockerSql(
      "set role service_role; select private.run_calendar_tick_command(jsonb_build_object('runId','integration-s17-tick'));",
      config.dbContainer,
    );
    const calendar = await rpc(clients.member, "get_room_calendar", {
      target_room_slug: fixture.data.roomSlug,
    });
    assert(calendar.length === 2, "El calendario conserva las dos publicaciones históricas");
    assert(
      calendar.some((entry) => entry.challenge_title === "Flash S17 integración"),
      "La publicación antigua sigue resolviendo la versión archivada",
    );
    const initialChallenge = await rpc(clients.member, "get_my_flash_challenge", {
      target_room_slug: fixture.data.roomSlug,
      target_publication_id: initialSchedule.data.scheduledChallengeId,
    });
    assert(initialChallenge.length === 2, "La sala sigue resolviendo el Flash histórico archivado");

    const rejectedSchedule = await clients.superadmin.rpc("create_superadmin_scheduled_challenge", {
      input: {
        idempotencyKey: "integration-s17-schedule-archived",
        seasonId: fixture.data.seasonId,
        challengeVersionId: created.data.challengeVersionId,
        number: 3,
        opensAt: new Date(Date.now() + 172_800_000).toISOString(),
        closesAt: new Date(Date.now() + 176_400_000).toISOString(),
        reason: "No programar archivado S17",
      },
    });
    assert(Boolean(rejectedSchedule.error), "Una nueva programación rechaza versiones archivadas");

    const memberComparison = await clients.member.rpc(
      "get_superadmin_challenge_version_comparison",
      {
        from_challenge_version_id: created.data.challengeVersionId,
        to_challenge_version_id: revision.data.challengeVersionId,
      },
    );
    assert(Boolean(memberComparison.error), "Un miembro no puede comparar versiones editoriales");
  },
};

export default scenario;
