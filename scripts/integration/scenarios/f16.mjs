import { rpc, sqlCount } from "../../support/supabase-local.mjs";
import { publishDraftQuestions } from "./publish-draft-questions.mjs";

export const scenario = {
  id: "f16",

  async run({ fixture, clients, config, assert }) {
    const editorialDocument = {
      challenge: {
        slug: "f16-editorial-mixed",
        title: "F16 editorial mixto",
        subtitle: "MC + Zip",
        description: "Publicación editorial de prueba para Zip.",
        mode: "flash",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: [
        {
          slug: "f16-editorial-choice",
          type: "multiple-choice",
          payloadSchemaVersion: 1,
          timeLimitMs: 15000,
          points: 50,
          publicPayload: { question: "¿Capital?", options: ["Lisboa", "Madrid"] },
          solutionPayload: { correctAnswer: "Lisboa", explanation: "Portugal." },
        },
        {
          slug: "f16-editorial-zip",
          type: "zip",
          payloadSchemaVersion: 1,
          timeLimitMs: 35000,
          points: 50,
          publicPayload: {
            category: "Lógica espacial",
            question: "Une los números en orden y cubre todas las celdas.",
            grid: { rows: 5, columns: 5 },
            checkpoints: [
              { value: 1, cell: 0 },
              { value: 2, cell: 4 },
              { value: 3, cell: 5 },
              { value: 4, cell: 14 },
              { value: 5, cell: 15 },
              { value: 6, cell: 24 },
            ],
            boardLabel: "Tablero Zip F16",
          },
          solutionPayload: {
            solution: [
              0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 11, 12, 13, 14, 19, 18, 17, 16, 15, 20, 21, 22,
              23, 24,
            ],
            explanation: "El camino serpentea por las cinco filas.",
          },
        },
      ],
    };
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: {
        idempotencyKey: "integration-f16-create",
        document: editorialDocument,
        reason: "F16",
      },
    });
    assert(!created.error && created.data?.questionCount === 2, "El portal crea un Flash editorial F16");

    const context = await clients.superadmin.rpc("get_superadmin_editorial_context");
    const draft = context.data?.entries?.find(
      (entry) => entry.challengeVersionId === created.data?.challengeVersionId,
    );
    assert(draft?.document?.questions?.[1]?.type === "zip", "La biblioteca conserva zip");
    assert(
      draft?.document?.questions?.[1]?.solutionPayload?.solution?.length === 25,
      "La solución privada de Zip se conserva en la biblioteca",
    );

    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: editorialDocument.questions.map((question) => question.slug),
      idempotencyKeyPrefix: "integration-f16-publish-question",
      reason: "Publicar preguntas F16",
      assert,
    });
    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-f16-publish",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: draft.updatedAt,
        reason: "Publicar F16",
      },
    });
    assert(!published.error && published.data?.status === "published", "El portal publica el Flash F16");

    const playable = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 2, "Alice recibe las dos preguntas de F16");
    assert(
      playable.map((row) => row.question_type).join(",") === "multiple-choice,zip",
      "F16 publica la mezcla con Zip en segunda posición",
    );
    const zip = playable[1];
    const serialized = JSON.stringify(zip);
    assert(zip.question_type === "zip" && zip.payload_schema_version === 1, "F16 publica Zip v1");
    assert(!serialized.includes("solution"), "El payload jugable no expone la ruta solución");
    assert(!serialized.includes("solutionPayload"), "La lectura jugable no expone solutionPayload");

    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe la proyección competitiva F16");
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La lectura de F16 no crea intentos",
    );
  },
};

export default scenario;
