import { rpc, sqlCount } from "../../support/supabase-local.mjs";
import { publishDraftQuestions } from "./publish-draft-questions.mjs";

export const scenario = {
  id: "e01",

  async run({ fixture, clients, config, assert }) {
    const editorialDocument = {
      challenge: {
        slug: "e01-editorial-mixed",
        title: "E01 editorial mixto",
        subtitle: "MC + Mini-Wordle",
        description: "Publicación editorial de prueba.",
        mode: "flash",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: [
        {
          slug: "e01-editorial-choice",
          type: "multiple-choice",
          payloadSchemaVersion: 1,
          timeLimitMs: 15000,
          points: 50,
          publicPayload: { question: "¿Capital?", options: ["Lisboa", "Madrid"] },
          solutionPayload: { correctAnswer: "Lisboa", explanation: "Portugal." },
        },
        {
          slug: "e01-editorial-wordle",
          type: "mini-wordle",
          payloadSchemaVersion: 1,
          timeLimitMs: 30000,
          points: 50,
          publicPayload: {
            question: "Descubre el personaje bíblico",
            hint: "Una figura central del cristianismo",
            wordLength: 5,
            maxAttempts: 4,
          },
          solutionPayload: {
            correctAnswer: "JESUS",
            additionalGuesses: ["JOSUE", "JACOB"],
            dictionaryId: "es-general-5.v1",
            explanation: "Una figura central del cristianismo.",
          },
        },
      ],
    };
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: { idempotencyKey: "integration-e01-create", document: editorialDocument, reason: "E01" },
    });
    assert(!created.error && created.data?.questionCount === 2, "El portal crea un Flash mixto E01");
    const context = await clients.superadmin.rpc("get_superadmin_editorial_context");
    const draft = context.data?.entries?.find(
      (entry) => entry.challengeVersionId === created.data?.challengeVersionId,
    );
    assert(draft?.document?.questions?.[1]?.type === "mini-wordle", "El portal conserva Mini-Wordle");
    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: editorialDocument.questions.map((question) => question.slug),
      idempotencyKeyPrefix: "integration-e01-publish-question",
      reason: "Publicar preguntas E01",
      assert,
    });
    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-e01-publish",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: draft.updatedAt,
        reason: "Publicar E01",
      },
    });
    assert(!published.error && published.data?.status === "published", "El portal publica el Flash mixto");

    const playable = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 2, "Alice recibe las dos preguntas de E01");
    assert(
      playable.map((row) => row.question_type).join(",") === "multiple-choice,mini-wordle",
      "E01 publica un Flash mixto con Mini-Wordle en segunda posición",
    );
    assert(
      playable.every((row) => row.item_points === 50),
      "E01 conserva 50 puntos por cada pregunta",
    );
    assert(
      !JSON.stringify(playable).includes("JESUS") &&
        !JSON.stringify(playable).includes("correctAnswer") &&
        !JSON.stringify(playable).includes("dictionaryId"),
      "La lectura jugable no filtra la solución ni el diccionario",
    );

    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe la proyección competitiva");
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La lectura de E01 no crea intentos",
    );
  },
};

export default scenario;
