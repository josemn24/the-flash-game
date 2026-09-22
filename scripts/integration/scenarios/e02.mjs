import { rpc, sqlCount } from "../../support/supabase-local.mjs";
import { publishDraftQuestions } from "./publish-draft-questions.mjs";

export const scenario = {
  id: "e02",

  async run({ fixture, clients, config, assert }) {
    const editorialDocument = {
      challenge: {
        slug: "e02-editorial-mixed",
        title: "E02 editorial mixto",
        subtitle: "MC + Logic-code",
        description: "Publicación editorial de prueba.",
        mode: "flash",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: [
        {
          slug: "e02-editorial-choice",
          type: "multiple-choice",
          payloadSchemaVersion: 1,
          timeLimitMs: 15000,
          points: 50,
          publicPayload: { question: "¿Capital?", options: ["Lisboa", "Madrid"] },
          solutionPayload: { correctAnswer: "Lisboa", explanation: "Portugal." },
        },
        {
          slug: "e02-editorial-code",
          type: "logic-code",
          payloadSchemaVersion: 1,
          timeLimitMs: 30000,
          points: 50,
          publicPayload: {
            question: "Descubre el código",
            codeLength: 4,
            clues: [
              { code: "1203", hint: "El segundo dígito es el doble del primero." },
              { code: "0312", hint: "El último dígito coincide con el tercero." },
            ],
          },
          solutionPayload: {
            correctAnswer: "0420",
            explanation: "La secuencia satisface las pistas.",
          },
        },
      ],
    };
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: {
        idempotencyKey: "integration-e02-create",
        document: editorialDocument,
        reason: "E02",
      },
    });
    assert(
      !created.error && created.data?.questionCount === 2,
      "El portal crea un Flash mixto E02",
    );
    const context = await clients.superadmin.rpc("get_superadmin_editorial_context");
    const draft = context.data?.entries?.find(
      (entry) => entry.challengeVersionId === created.data?.challengeVersionId,
    );
    assert(draft?.document?.questions?.[1]?.type === "logic-code", "El portal conserva Logic-code");
    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: editorialDocument.questions.map((question) => question.slug),
      idempotencyKeyPrefix: "integration-e02-publish-question",
      reason: "Publicar preguntas E02",
      assert,
    });
    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-e02-publish",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: draft.updatedAt,
        reason: "Publicar E02",
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
    assert(playable.length === 2, "Alice recibe las dos preguntas de E02");
    assert(
      playable.map((row) => row.question_type).join(",") === "multiple-choice,logic-code",
      "E02 publica un Flash mixto con Logic-code en segunda posición",
    );
    assert(
      !JSON.stringify(playable).includes("0420") &&
        !JSON.stringify(playable).includes("correctAnswer"),
      "La lectura jugable no filtra la solución Logic-code",
    );
    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe la proyección competitiva");
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La lectura de E02 no crea intentos",
    );
  },
};

export default scenario;
