const document = {
  challenge: {
    slug: "flash-s11-integration",
    title: "Flash S11 integración",
    subtitle: "Dos preguntas",
    description: "Contenido editorial mínimo persistido.",
    mode: "flash",
    configSchemaVersion: 1,
    modeConfig: {},
  },
  questions: [
    {
      slug: "s11-capital",
      type: "multiple-choice",
      payloadSchemaVersion: 1,
      timeLimitMs: 15000,
      points: 50,
      publicPayload: {
        category: "Cultura general",
        tags: {},
        question: "¿Cuál es la capital de Portugal?",
        options: ["Lisboa", "Oporto", "Braga"],
        media: null,
        promptVisual: null,
      },
      solutionPayload: {
        correctAnswer: "Lisboa",
        explanation: "Lisboa es la capital de Portugal.",
      },
    },
    {
      slug: "s11-planeta",
      type: "multiple-choice",
      payloadSchemaVersion: 1,
      timeLimitMs: 12000,
      points: 50,
      publicPayload: {
        category: "Ciencia",
        tags: {},
        question: "¿Qué planeta es conocido como el planeta rojo?",
        options: ["Marte", "Venus", "Júpiter"],
        media: null,
        promptVisual: null,
      },
      solutionPayload: {
        correctAnswer: "Marte",
        explanation: "Marte tiene una superficie de color rojizo.",
      },
    },
  ],
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
    assert(created.data?.questionCount === 2, "El borrador contiene dos preguntas");
    assert(created.data?.document === null, "El resultado de comando no reexpone soluciones");

    const repeated = await clients.superadmin.rpc("create_superadmin_flash_draft", { input: createInput });
    assert(!repeated.error && repeated.data?.challengeVersionId === created.data?.challengeVersionId,
      "La creación editorial es idempotente");

    const draftContext = await clients.superadmin.rpc("get_superadmin_editorial_context");
    const draft = draftContext.data?.entries?.find(
      (entry) => entry.challengeVersionId === created.data?.challengeVersionId,
    );
    assert(draft?.status === "draft" && draft?.document?.questions?.length === 2,
      "El contexto protegido devuelve el documento completo del borrador");
    assert(draft?.document?.questions?.[0]?.solutionPayload?.correctAnswer === "Lisboa",
      "La solución solo aparece en el contexto protegido");

    const updatedDocument = {
      ...document,
      challenge: { ...document.challenge, title: "Flash S11 editado" },
      questions: [
        { ...document.questions[0], timeLimitMs: 16000 },
        { ...document.questions[1], publicPayload: { ...document.questions[1].publicPayload, options: ["Marte", "Venus", "Saturno"] } },
      ],
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
