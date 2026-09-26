import { rpc, sqlCount } from "../../support/supabase-local.mjs";
import { publishDraftQuestions } from "./publish-draft-questions.mjs";

export const scenario = {
  id: "e03",

  async run({ fixture, clients, config, assert }) {
    const editorialDocument = {
      challenge: {
        slug: "e03-editorial-mixed",
        title: "E03 editorial mixto",
        subtitle: "MC + Progressive-clues",
        description: "Publicación editorial de prueba.",
        mode: "flash",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: [
        {
          slug: "e03-editorial-choice",
          type: "multiple-choice",
          payloadSchemaVersion: 1,
          timeLimitMs: 15000,
          points: 50,
          publicPayload: { question: "¿Capital?", options: ["Lisboa", "Madrid"] },
          solutionPayload: { correctAnswer: "Lisboa", explanation: "Portugal." },
        },
        {
          slug: "e03-editorial-progressive",
          type: "progressive-clues",
          payloadSchemaVersion: 1,
          timeLimitMs: 90000,
          points: 50,
          publicPayload: {
            question: "Identifica el acontecimiento",
            clues: [
              "Ocurrió en Europa.",
              "Está relacionado con una caída de muro.",
              "Sucedió en 1989.",
            ],
            cluePenalty: 25,
          },
          solutionPayload: {
            correctAnswer: "Caída del muro de Berlín",
            acceptedAnswers: ["caida del muro de berlin", "muro de berlin"],
            explanation: "La respuesta identifica el acontecimiento.",
          },
        },
      ],
    };
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: {
        idempotencyKey: "integration-e03-create",
        document: editorialDocument,
        reason: "E03",
      },
    });
    assert(
      !created.error && created.data?.questionCount === 2,
      "El portal crea un Flash mixto E03",
    );
    const context = await clients.superadmin.rpc("get_superadmin_editorial_context");
    const draft = context.data?.entries?.find(
      (entry) => entry.challengeVersionId === created.data?.challengeVersionId,
    );
    assert(
      draft?.document?.questions?.[1]?.type === "progressive-clues",
      "El portal conserva Progressive-clues",
    );
    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: editorialDocument.questions.map((question) => question.slug),
      idempotencyKeyPrefix: "integration-e03-publish-question",
      reason: "Publicar preguntas E03",
      assert,
    });
    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-e03-publish",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: draft.updatedAt,
        reason: "Publicar E03",
      },
    });
    assert(
      !published.error && published.data?.status === "published",
      "El portal publica el Flash mixto",
    );

    const playable = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 2, "Alice recibe las dos preguntas de E03");
    assert(
      playable.map((row) => row.question_type).join(",") === "multiple-choice,progressive-clues",
      "E03 publica Progressive-clues en segunda posición",
    );
    assert(
      !JSON.stringify(playable).includes("Está relacionado") &&
        !JSON.stringify(playable).includes("Caída del muro") &&
        !JSON.stringify(playable).includes("acceptedAnswers"),
      "La lectura jugable no filtra pistas futuras ni la solución",
    );
    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe la proyección competitiva");
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La lectura de E03 no crea intentos",
    );
  },
};

export default scenario;
