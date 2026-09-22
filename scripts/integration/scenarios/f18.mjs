import { rpc, sqlCount } from "../../support/supabase-local.mjs";
import { publishDraftQuestions } from "./publish-draft-questions.mjs";

export const scenario = {
  id: "f18",

  async run({ fixture, clients, config, assert }) {
    const runKey = Date.now().toString(36);
    const editorialDocument = {
      challenge: {
        slug: `f18-editorial-mixed-${runKey}`,
        title: "F18 editorial mixto",
        subtitle: "MC + Escape",
        description: "Publicación editorial de prueba para Escape.",
        mode: "flash",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: [
        {
          slug: `f18-editorial-choice-${runKey}`,
          type: "multiple-choice",
          payloadSchemaVersion: 1,
          timeLimitMs: 15000,
          points: 50,
          publicPayload: { question: "¿Capital?", options: ["Lisboa", "Madrid"] },
          solutionPayload: { correctAnswer: "Lisboa", explanation: "Portugal." },
        },
        {
          slug: `f18-editorial-escape-${runKey}`,
          type: "escape",
          payloadSchemaVersion: 1,
          timeLimitMs: 30000,
          points: 50,
          publicPayload: {
            category: "Lógica espacial",
            question: "Mueve los bloques para liberar la pieza amarilla.",
            grid: { rows: 6, columns: 6, exit: { side: "right", row: 2 } },
            initialBlocks: [
              { id: "target", kind: "target", orientation: "horizontal", row: 2, column: 0, length: 2 },
              { id: "a", kind: "obstacle", orientation: "vertical", row: 1, column: 2, length: 2 },
              { id: "b", kind: "obstacle", orientation: "vertical", row: 0, column: 4, length: 3 },
              { id: "c", kind: "obstacle", orientation: "horizontal", row: 0, column: 1, length: 2 },
              { id: "d", kind: "obstacle", orientation: "horizontal", row: 4, column: 1, length: 2 },
            ],
            boardLabel: "Tablero Escape F18",
          },
          solutionPayload: {
            referenceSolution: [
              { blockId: "c", from: 1, to: 0 },
              { blockId: "a", from: 1, to: 0 },
              { blockId: "b", from: 0, to: 3 },
              { blockId: "target", from: 0, to: 4 },
            ],
            optimalMoves: 4,
            explanation: "La referencia despeja los obstáculos.",
          },
        },
      ],
    };
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: {
        idempotencyKey: `integration-f18-create-${runKey}`,
        document: editorialDocument,
        reason: "F18",
      },
    });
    assert(!created.error && created.data?.questionCount === 2, "El portal crea un Flash editorial F18");

    const context = await clients.superadmin.rpc("get_superadmin_editorial_context");
    const draft = context.data?.entries?.find(
      (entry) => entry.challengeVersionId === created.data?.challengeVersionId,
    );
    assert(draft?.document?.questions?.[1]?.type === "escape", "La biblioteca conserva escape");
    assert(
      draft?.document?.questions?.[1]?.solutionPayload?.referenceSolution?.length === 4,
      "La solución privada de Escape se conserva en la biblioteca",
    );

    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: editorialDocument.questions.map((question) => question.slug),
      idempotencyKeyPrefix: `integration-f18-publish-question-${runKey}`,
      reason: "Publicar preguntas F18",
      assert,
    });
    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: `integration-f18-publish-${runKey}`,
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: draft.updatedAt,
        reason: "Publicar F18",
      },
    });
    assert(!published.error && published.data?.status === "published", "El portal publica el Flash F18");

    const playable = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 2, "Alice recibe las dos preguntas de F18");
    assert(
      playable.map((row) => row.question_type).join(",") === "multiple-choice,escape",
      "F18 publica la mezcla con Escape en segunda posición",
    );
    const escape = playable[1];
    const serialized = JSON.stringify(escape);
    assert(escape.question_type === "escape" && escape.payload_schema_version === 1, "F18 publica Escape v1");
    assert(!serialized.includes("referenceSolution"), "El payload jugable no expone la solución de referencia");
    assert(!serialized.includes("optimalMoves"), "El payload jugable no expone el óptimo editorial");
    assert(!serialized.includes("solutionPayload"), "La lectura jugable no expone solutionPayload");

    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe la proyección competitiva F18");
    assert(
      (await sqlCount(
        `select count(*) from public.attempts where challenge_version_id = '${fixture.data.challengeVersionId}';`,
        config.dbContainer,
      )) === 0,
      "La lectura de F18 no crea intentos",
    );
  },
};

export default scenario;
