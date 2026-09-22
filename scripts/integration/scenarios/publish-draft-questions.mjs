export async function publishDraftQuestions({ client, slugs, idempotencyKeyPrefix, reason, assert }) {
  const library = await client.rpc("get_superadmin_question_library", {
    input: { status: "draft", pageSize: 25 },
  });
  assert(
    !library.error && Array.isArray(library.data?.entries),
    "El catálogo de preguntas está disponible",
  );

  for (const [index, slug] of slugs.entries()) {
    const question = library.data.entries.find((entry) => entry.slug === slug);
    assert(question, `La pregunta ${slug} aparece en el catálogo editorial`);
    const published = await client.rpc("publish_superadmin_question", {
      input: {
        idempotencyKey: `${idempotencyKeyPrefix}-${index + 1}`,
        questionVersionId: question.questionVersionId,
        expectedUpdatedAt: question.updatedAt,
        reason,
      },
    });
    assert(
      !published.error &&
        published.data?.versions?.some(
          (version) =>
            version.questionVersionId === question.questionVersionId && version.status === "published",
        ),
      `El superadmin publica la pregunta ${slug}`,
    );
  }
}
