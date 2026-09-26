import { rpc, sqlCount } from "../../support/supabase-local.mjs";
import { publishDraftQuestions } from "./publish-draft-questions.mjs";

export const scenario = {
  id: "f08",

  async run({ fixture, clients, config, assert }) {
    const editorialDocument = {
      challenge: {
        slug: "f08-editorial-mixed",
        title: "F08 editorial mixto",
        subtitle: "MC + Logic-matrix",
        description: "Publicación editorial de prueba para la matriz lógica.",
        mode: "flash",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: [
        {
          slug: "f08-editorial-choice",
          type: "multiple-choice",
          payloadSchemaVersion: 1,
          timeLimitMs: 15000,
          points: 50,
          publicPayload: { question: "¿Capital?", options: ["Lisboa", "Madrid"] },
          solutionPayload: { correctAnswer: "Lisboa", explanation: "Portugal." },
        },
        {
          slug: "f08-editorial-logic-matrix",
          type: "logic-matrix",
          payloadSchemaVersion: 1,
          timeLimitMs: 30000,
          points: 50,
          publicPayload: {
            category: "Lógica visual",
            tags: { topics: ["patterns"] },
            question: "¿Qué pieza completa la matriz?",
            pieces: [
              { id: "a", symbol: "A", label: "Pieza A" },
              { id: "b", symbol: "B", label: "Pieza B" },
              { id: "c", symbol: "C", label: "Pieza C" },
              { id: "d", symbol: "D", label: "Pieza D" },
            ],
            cells: ["a", "b", "c", "b", "c", "a", "c", "a", null],
            optionIds: ["d", "a", "b", "c"],
            showPieceLabels: false,
          },
          solutionPayload: { correctOptionId: "d", explanation: "La pieza D completa el patrón." },
        },
      ],
    };
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: {
        idempotencyKey: "integration-f08-create",
        document: editorialDocument,
        reason: "F08",
      },
    });
    assert(
      !created.error && created.data?.questionCount === 2,
      "El portal crea un Flash editorial F08",
    );
    const context = await clients.superadmin.rpc("get_superadmin_editorial_context");
    const draft = context.data?.entries?.find(
      (entry) => entry.challengeVersionId === created.data?.challengeVersionId,
    );
    assert(
      draft?.document?.questions?.[1]?.type === "logic-matrix",
      "La biblioteca conserva logic-matrix",
    );
    assert(
      draft?.document?.questions?.[1]?.solutionPayload?.correctOptionId === "d",
      "La solución de la matriz permanece privada en la biblioteca",
    );
    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: editorialDocument.questions.map((question) => question.slug),
      idempotencyKeyPrefix: "integration-f08-publish-question",
      reason: "Publicar preguntas F08",
      assert,
    });
    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-f08-publish",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: draft.updatedAt,
        reason: "Publicar F08",
      },
    });
    assert(
      !published.error && published.data?.status === "published",
      "El portal publica el Flash F08",
    );

    const playable = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 3, "Alice recibe las tres preguntas de F08");
    assert(
      playable.map((row) => row.question_type).join(",") ===
        "multiple-choice,logic-matrix,logic-matrix",
      "F08 publica la mezcla con logic-matrix en segunda y tercera posición",
    );
    const matrix = playable[1];
    const serialized = JSON.stringify(matrix);
    assert(
      matrix.question_type === "logic-matrix" && matrix.payload_schema_version === 1,
      "F08 publica la versión de matriz esperada",
    );
    assert(!serialized.includes("correctOptionId"), "El payload jugable no expone la solución");
    assert(!serialized.includes("solutionPayload"), "La lectura jugable no expone solutionPayload");

    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe la proyección competitiva F08");
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La lectura de F08 no crea intentos",
    );
  },
};

export default scenario;
