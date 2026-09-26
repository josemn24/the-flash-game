import { publishDraftQuestions } from "./publish-draft-questions.mjs";

const document = {
  challenge: {
    slug: "flash-s11-integration",
    title: "Flash S11 integración",
    subtitle: "Cinco preguntas",
    description: "Contenido editorial mínimo persistido.",
    mode: "flash",
    configSchemaVersion: 1,
    modeConfig: {},
  },
  questions: Array.from({ length: 5 }, (_, index) => ({
    slug: `s11-question-${index + 1}`,
    type: "multiple-choice",
    payloadSchemaVersion: 1,
    timeLimitMs: index === 0 ? 15000 : 12000,
    points: 20,
    publicPayload: {
      category: index % 2 === 0 ? "Cultura general" : "Ciencia",
      tags: {},
      question: `¿Pregunta editorial ${index + 1}?`,
      options: ["A", "B", "C"],
      media: null,
      promptVisual: null,
    },
    solutionPayload: {
      correctAnswer: "A",
      explanation: `Respuesta editorial ${index + 1}.`,
    },
  })),
};

export const scenario = {
  id: "s11",

  async run({ fixture, clients, assert }) {
    const initial = await clients.superadmin.rpc("get_superadmin_editorial_context");
    assert(!initial.error && Array.isArray(initial.data?.entries), "El contexto editorial está disponible");

    const createInput = {
      idempotencyKey: "integration-s11-create-1",
      document,
      reason: "Preparar contenido S11",
    };
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", { input: createInput });
    assert(!created.error && created.data?.status === "draft", "El superadmin crea el borrador Flash");
    assert(created.data?.questionCount === 5, "El borrador contiene cinco preguntas");
    assert(created.data?.document === null, "El resultado de comando no reexpone soluciones");

    const repeated = await clients.superadmin.rpc("create_superadmin_flash_draft", { input: createInput });
    assert(!repeated.error && repeated.data?.challengeVersionId === created.data?.challengeVersionId,
      "La creación editorial es idempotente");

    const draftContext = await clients.superadmin.rpc("get_superadmin_editorial_context");
    const draft = draftContext.data?.entries?.find(
      (entry) => entry.challengeVersionId === created.data?.challengeVersionId,
    );
    assert(draft?.status === "draft" && draft?.document?.questions?.length === 5,
      "El contexto protegido devuelve las cinco preguntas del borrador");
    assert(draft?.document?.questions?.[0]?.solutionPayload?.correctAnswer === "A",
      "La solución solo aparece en el contexto protegido");

    const updatedDocument = {
      ...document,
      challenge: { ...document.challenge, title: "Flash S11 editado" },
      questions: document.questions.map((question, index) => ({
        ...question,
        timeLimitMs: index === 0 ? 16000 : question.timeLimitMs,
        publicPayload: index === 1
          ? { ...question.publicPayload, options: ["A", "B", "D"] }
          : question.publicPayload,
      })),
    };
    const updated = await clients.superadmin.rpc("update_superadmin_flash_draft", {
      input: {
        idempotencyKey: "integration-s11-update-1",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: draft.updatedAt,
        document: updatedDocument,
        reason: "Ajustar contenido S11",
      },
    });
    assert(!updated.error && updated.data?.title === "Flash S11 editado", "El superadmin edita el borrador");

    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: updatedDocument.questions.map((question) => question.slug),
      idempotencyKeyPrefix: "integration-s11-publish-question",
      reason: "Publicar preguntas S11",
      assert,
    });

    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-s11-publish-1",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: updated.data.updatedAt,
        reason: "Publicar contenido S11",
      },
    });
    assert(!published.error && published.data?.status === "published", "El superadmin publica explícitamente");

    const publishedContext = await clients.superadmin.rpc("get_superadmin_editorial_context");
    const publishedEntry = publishedContext.data?.entries?.find(
      (entry) => entry.challengeVersionId === created.data?.challengeVersionId,
    );
    assert(publishedEntry?.status === "published" && publishedEntry.document === null,
      "La versión publicada queda como metadato sin soluciones");

    const duplicatePublish = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-s11-publish-2",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: published.data.updatedAt,
        reason: "Reintentar publicación S11",
      },
    });
    assert(Boolean(duplicatePublish.error), "La publicación doble se rechaza");

    const memberContext = await clients.member.rpc("get_superadmin_editorial_context");
    assert(Boolean(memberContext.error), "Un miembro no puede leer el contexto editorial protegido");
    const outsiderContext = await clients.outsider.rpc("get_superadmin_editorial_context");
    assert(Boolean(outsiderContext.error), "Un usuario externo no puede leer el contexto editorial protegido");
    assert(fixture.data.roomSlug === "s11-room", "El escenario usa una sala local activa");
  },
};

export default scenario;
