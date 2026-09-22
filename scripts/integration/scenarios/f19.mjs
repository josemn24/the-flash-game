import { rpc } from "../../support/supabase-local.mjs";
import { publishDraftQuestions } from "./publish-draft-questions.mjs";

export const scenario = {
  id: "f19",

  async run({ fixture, clients, assert }) {
    const runKey = Date.now().toString(36);
    const editorialDocument = {
      challenge: {
        slug: `f19-editorial-mixed-${runKey}`,
        title: "F19 editorial mixto",
        subtitle: "MC + Word-hashtag",
        description: "Publicación editorial de prueba para Word-hashtag.",
        mode: "flash",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: [
        {
          slug: `f19-editorial-choice-${runKey}`,
          type: "multiple-choice",
          payloadSchemaVersion: 1,
          timeLimitMs: 15000,
          points: 50,
          publicPayload: { question: "¿Capital?", options: ["Lisboa", "Madrid"] },
          solutionPayload: { correctAnswer: "Lisboa", explanation: "Portugal." },
        },
        {
          slug: `f19-editorial-word-hashtag-${runKey}`,
          type: "word-hashtag",
          payloadSchemaVersion: 1,
          timeLimitMs: 45000,
          points: 50,
          publicPayload: {
            category: "Lengua",
            question: "Intercambia las letras amarillas para completar las cuatro palabras.",
            grid: { rows: 5, columns: 5 },
            initialLetters: [
              null, "G", null, "Q", null,
              "E", "O", "P", "U", "I",
              null, "N", null, "Y", null,
              "R", "A", "U", "M", "E",
              null, "R", null, "A", null,
            ],
            maxMoves: 7,
          },
          solutionPayload: {
            words: { top: "YOGUI", bottom: "REUMA", left: "PONER", right: "QUEMA" },
            explanation: "Las cuatro palabras se cruzan en forma de hashtag.",
          },
        },
      ],
    };
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: {
        idempotencyKey: `integration-f19-create-${runKey}`,
        document: editorialDocument,
        reason: "F19",
      },
    });
    assert(!created.error && created.data?.questionCount === 2, "El portal crea un Flash editorial F19");

    const context = await clients.superadmin.rpc("get_superadmin_editorial_context");
    const draft = context.data?.entries?.find(
      (entry) => entry.challengeVersionId === created.data?.challengeVersionId,
    );
    assert(draft?.document?.questions?.[1]?.type === "word-hashtag", "La biblioteca conserva word-hashtag");
    assert(
      draft?.document?.questions?.[1]?.solutionPayload?.words?.top === "YOGUI",
      "La solución privada de F19 se conserva en la biblioteca",
    );

    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: editorialDocument.questions.map((question) => question.slug),
      idempotencyKeyPrefix: `integration-f19-publish-question-${runKey}`,
      reason: "Publicar preguntas F19",
      assert,
    });
    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: `integration-f19-publish-${runKey}`,
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: draft.updatedAt,
        reason: "Publicar F19",
      },
    });
    assert(!published.error && published.data?.status === "published", "El portal publica el Flash F19");

    const playable = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 2, "Alice recibe las dos preguntas de F19");
    assert(
      playable.map((row) => row.question_type).join(",") === "multiple-choice,word-hashtag",
      "F19 publica word-hashtag en segunda posición",
    );
    const wordHashtag = playable[1];
    const serialized = JSON.stringify(wordHashtag);
    assert(wordHashtag.payload_schema_version === 1, "F19 usa payload v1");
    assert(!serialized.includes("words"), "El payload jugable no expone las palabras solución");
    assert(!serialized.includes("solutionPayload"), "La lectura jugable no expone solutionPayload");

    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe la proyección competitiva F19");
  },
};

export default scenario;
