import { rpc, sqlCount } from "../../support/supabase-local.mjs";
import { publishDraftQuestions } from "./publish-draft-questions.mjs";

export const scenario = {
  id: "e04",

  async run({ fixture, clients, config, assert }) {
    const editorialDocument = {
      challenge: {
        slug: "e04-editorial-mixed",
        title: "E04 editorial mixto",
        subtitle: "MC + Matching",
        description: "Publicación editorial de prueba.",
        mode: "flash",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: [
        {
          slug: "e04-editorial-choice",
          type: "multiple-choice",
          payloadSchemaVersion: 1,
          timeLimitMs: 15000,
          points: 50,
          publicPayload: { question: "¿Capital?", options: ["Lisboa", "Madrid"] },
          solutionPayload: { correctAnswer: "Lisboa", explanation: "Portugal." },
        },
        {
          slug: "e04-editorial-matching",
          type: "matching",
          payloadSchemaVersion: 1,
          timeLimitMs: 60000,
          points: 50,
          publicPayload: {
            question: "Relaciona cada concepto",
            leftItems: [
              { id: "l1", label: "Uno" },
              { id: "l2", label: "Dos" },
              { id: "l3", label: "Tres" },
            ],
            rightItems: [
              { id: "r1", label: "Primero" },
              { id: "r2", label: "Segundo" },
              { id: "r3", label: "Tercero" },
            ],
          },
          solutionPayload: {
            matches: { l1: "r1", l2: "r2", l3: "r3" },
            explanation: "Cada concepto tiene su equivalente.",
          },
        },
      ],
    };
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: {
        idempotencyKey: "integration-e04-create",
        document: editorialDocument,
        reason: "E04",
      },
    });
    assert(
      !created.error && created.data?.questionCount === 2,
      `El portal crea un Flash mixto E04${created.error ? `: ${JSON.stringify(created.error)}` : ""}`,
    );
    const context = await clients.superadmin.rpc("get_superadmin_editorial_context");
    const draft = context.data?.entries?.find(
      (entry) => entry.challengeVersionId === created.data?.challengeVersionId,
    );
    assert(draft?.document?.questions?.[1]?.type === "matching", "El portal conserva Matching");
    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: editorialDocument.questions.map((question) => question.slug),
      idempotencyKeyPrefix: "integration-e04-publish-question",
      reason: "Publicar preguntas E04",
      assert,
    });
    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-e04-publish",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: draft.updatedAt,
        reason: "Publicar E04",
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
    assert(playable.length === 2, "Alice recibe las dos preguntas de E04");
    assert(
      playable.map((row) => row.question_type).join(",") === "multiple-choice,matching",
      "E04 publica Matching en segunda posición",
    );
    assert(
      !JSON.stringify(playable).includes("correctMatchId") &&
        !JSON.stringify(playable).includes('"matches"'),
      "La lectura jugable no filtra la correspondencia privada",
    );
    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe la proyección competitiva");
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La lectura de E04 no crea intentos",
    );
  },
};

export default scenario;
