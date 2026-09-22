import { rpc, sqlCount } from "../../support/supabase-local.mjs";
import { publishDraftQuestions } from "./publish-draft-questions.mjs";

export const scenario = {
  id: "e06",

  async run({ fixture, clients, config, assert }) {
    const editorialDocument = {
      challenge: {
        slug: "e06-editorial-mixed",
        title: "E06 editorial mixto",
        subtitle: "MC + Word-search",
        description: "Publicación editorial de prueba para la sopa de letras.",
        mode: "flash",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: [
        {
          slug: "e06-editorial-choice",
          type: "multiple-choice",
          payloadSchemaVersion: 1,
          timeLimitMs: 15000,
          points: 50,
          publicPayload: { question: "¿Capital?", options: ["Lisboa", "Madrid"] },
          solutionPayload: { correctAnswer: "Lisboa", explanation: "Portugal." },
        },
        {
          slug: "e06-editorial-word-search",
          type: "word-search",
          payloadSchemaVersion: 1,
          timeLimitMs: 90000,
          points: 50,
          publicPayload: {
            question: "Encuentra CASA y ÑANDÚ",
            category: "Lengua",
            tags: { domains: ["language"], topics: ["vocabulary"] },
            grid: { rows: 6, columns: 6 },
            letters: [
              "C", "A", "S", "A", "X", "X",
              "Ñ", "A", "N", "D", "Ú", "Z",
              "B", "Q", "E", "R", "T", "Y",
              "G", "H", "I", "J", "K", "L",
              "M", "O", "P", "V", "W", "F",
              "Á", "É", "Í", "Ó", "Ú", "Ü",
            ],
            targets: [
              { id: "casa", word: "CASA" },
              { id: "nandu", word: "ÑANDÚ" },
            ],
          },
          solutionPayload: {
            positionsByTargetId: {
              casa: { startCell: 0, endCell: 3 },
              nandu: { startCell: 6, endCell: 10 },
            },
            explanation: "Las palabras se encuentran en las dos primeras filas.",
          },
        },
      ],
    };
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: { idempotencyKey: "integration-e06-create", document: editorialDocument, reason: "E06" },
    });
    assert(!created.error && created.data?.questionCount === 2, "El portal crea un Flash mixto E06");
    const context = await clients.superadmin.rpc("get_superadmin_editorial_context");
    const draft = context.data?.entries?.find(
      (entry) => entry.challengeVersionId === created.data?.challengeVersionId,
    );
    assert(draft?.document?.questions?.[1]?.type === "word-search", "El portal conserva Word-search");
    assert(
      draft?.document?.questions?.[1]?.solutionPayload?.positionsByTargetId?.casa,
      "La biblioteca conserva la solución privada",
    );
    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: editorialDocument.questions.map((question) => question.slug),
      idempotencyKeyPrefix: "integration-e06-publish-question",
      reason: "Publicar preguntas E06",
      assert,
    });
    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-e06-publish",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: draft.updatedAt,
        reason: "Publicar E06",
      },
    });
    assert(!published.error && published.data?.status === "published", "El portal publica el Flash E06");

    const playable = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 2, "Alice recibe las dos preguntas de E06");
    assert(
      playable.map((row) => row.question_type).join(",") === "multiple-choice,word-search",
      "E06 publica Word-search en segunda posición",
    );
    const serialized = JSON.stringify(playable);
    assert(!serialized.includes("startCell") && !serialized.includes("endCell"), "El payload jugable no expone posiciones");
    assert(!serialized.includes("positionsByTargetId"), "El payload jugable no expone la solución privada");

    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe la proyección competitiva");
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La lectura de E06 no crea intentos",
    );
  },
};

export default scenario;
