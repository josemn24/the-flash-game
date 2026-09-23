import { publishDraftQuestions } from "./publish-draft-questions.mjs";
import { dockerSql, rpc } from "../../support/supabase-local.mjs";

const questions = Array.from({ length: 7 }, (_, index) => {
  const level = index + 1;
  const formatQuestion =
    level === 1
      ? {
          type: "true-false",
          publicPayload: { question: "El agua se congela a 0 °C." },
          solutionPayload: { correctAnswer: true, explanation: "A presión normal, sí." },
        }
      : level === 2
        ? {
            type: "ordering",
            publicPayload: { question: "Ordena las letras.", items: ["A", "C", "B"] },
            solutionPayload: { correctOrder: ["A", "B", "C"], explanation: "Orden alfabético." },
          }
        : level === 3
          ? {
              type: "classification",
              publicPayload: {
                question: "Clasifica cada elemento.",
                items: [{ label: "Gato" }, { label: "Rosa" }],
                categories: ["Animal", "Planta"],
              },
              solutionPayload: {
                categoriesByItem: { Gato: "Animal", Rosa: "Planta" },
                explanation: "El gato es un animal y la rosa es una planta.",
              },
            }
          : level === 4
            ? {
                type: "logic-matrix",
                publicPayload: {
                  question: "¿Qué pieza completa la matriz?",
                  pieces: [
                    { id: "a", symbol: "A", label: "Pieza A" },
                    { id: "b", symbol: "B", label: "Pieza B" },
                    { id: "c", symbol: "C", label: "Pieza C" },
                    { id: "d", symbol: "D", label: "Pieza D" },
                  ],
                  cells: ["a", "b", "c", "b", "c", "a", "c", "a", null],
                  optionIds: ["d", "a", "b", "c"],
                  showPieceLabels: true,
                },
                solutionPayload: {
                  correctOptionId: "d",
                  explanation: "La pieza D completa el patrón.",
                },
              }
            : level === 5
              ? {
                  type: "zip",
                  publicPayload: {
                    category: "Lógica espacial",
                    tags: {},
                    question: "Une los números en orden y cubre la cuadrícula.",
                    grid: { rows: 5, columns: 5 },
                    checkpoints: [
                      { value: 1, cell: 0 },
                      { value: 2, cell: 4 },
                      { value: 3, cell: 5 },
                      { value: 4, cell: 14 },
                      { value: 5, cell: 15 },
                      { value: 6, cell: 24 },
                    ],
                  },
                  solutionPayload: {
                    solution: [
                      0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 11, 12, 13, 14, 19, 18, 17, 16, 15, 20, 21,
                      22, 23, 24,
                    ],
                    explanation: "El camino visita los seis checkpoints y recorre las 25 celdas.",
                  },
                }
              : level === 6
                ? {
                    type: "escape",
                    publicPayload: {
                      category: "Lógica espacial",
                      tags: {},
                      question: "Mueve los bloques para liberar la pieza amarilla.",
                      grid: { rows: 6, columns: 6, exit: { side: "right", row: 2 } },
                      initialBlocks: [
                        {
                          id: "target",
                          kind: "target",
                          orientation: "horizontal",
                          row: 2,
                          column: 0,
                          length: 2,
                        },
                        {
                          id: "a",
                          kind: "obstacle",
                          orientation: "vertical",
                          row: 1,
                          column: 2,
                          length: 2,
                        },
                        {
                          id: "b",
                          kind: "obstacle",
                          orientation: "vertical",
                          row: 0,
                          column: 4,
                          length: 3,
                        },
                        {
                          id: "c",
                          kind: "obstacle",
                          orientation: "horizontal",
                          row: 0,
                          column: 1,
                          length: 2,
                        },
                        {
                          id: "d",
                          kind: "obstacle",
                          orientation: "horizontal",
                          row: 4,
                          column: 1,
                          length: 2,
                        },
                      ],
                      boardLabel: "Tablero Escape de Pirámide",
                    },
                    solutionPayload: {
                      referenceSolution: [
                        { blockId: "c", from: 1, to: 0 },
                        { blockId: "a", from: 1, to: 0 },
                        { blockId: "b", from: 0, to: 3 },
                        { blockId: "target", from: 0, to: 4 },
                      ],
                      optimalMoves: 4,
                      explanation: "Despeja la fila del objetivo y llévalo a la salida.",
                    },
                  }
                : level === 7
                  ? {
                      type: "word-hashtag",
                      publicPayload: {
                        category: "Lengua",
                        tags: {},
                        question: "Intercambia las letras para completar las cuatro palabras.",
                        grid: { rows: 5, columns: 5 },
                        initialLetters: [
                          null,
                          "G",
                          null,
                          "Q",
                          null,
                          "E",
                          "O",
                          "P",
                          "U",
                          "I",
                          null,
                          "N",
                          null,
                          "Y",
                          null,
                          "R",
                          "A",
                          "U",
                          "M",
                          "E",
                          null,
                          "R",
                          null,
                          "A",
                          null,
                        ],
                        maxMoves: 3,
                      },
                      solutionPayload: {
                        words: { top: "YOGUI", bottom: "REUMA", left: "PONER", right: "QUEMA" },
                        explanation: "Tres intercambios completan YOGUI, REUMA, PONER y QUEMA.",
                      },
                    }
                  : {
                      type: "multiple-choice",
                      publicPayload: {
                        category: "Lógica",
                        tags: {},
                        question: `S15 nivel ${level}: ¿qué color se mezcla con azul para formar violeta?`,
                        options: ["Rojo", "Verde"],
                        media: null,
                        promptVisual: null,
                      },
                      solutionPayload: {
                        correctAnswer: "Rojo",
                        explanation: "El rojo mezclado con azul forma violeta.",
                      },
                    };
  return {
    slug: `s15-integration-q${level}`,
    ...formatQuestion,
    payloadSchemaVersion: 1,
    timeLimitMs: level === 5 ? 90000 : level === 6 ? 60000 : level === 7 ? 60000 : 15000,
    points: index < 5 ? 14 : 15,
    modeConfig: {
      levelId: `level-${level}`,
      label: `Nivel ${level}`,
      briefing: {
        title: `Briefing ${level}`,
        format: "Prueba competitiva",
        description: `Resuelve la prueba del nivel ${level} para seguir ascendiendo.`,
      },
    },
  };
});

const document = {
  challenge: {
    slug: "pyramid-s15-integration",
    title: "La Pirámide S15 integración",
    subtitle: "Siete niveles persistidos",
    description: "Contenido competitivo de La Pirámide publicado desde el portal.",
    mode: "pyramid",
    configSchemaVersion: 1,
    modeConfig: {},
  },
  questions,
};

const sharedGateDocuments = ["flash", "survival"].map((mode) => ({
  challenge: {
    slug: `s15-${mode}-new-format-gate`,
    title: `S15 ${mode} formatos nuevos`,
    subtitle: "Zip, Escape y Word Hashtag",
    description: `Comprueba la admisión compartida de formatos en ${mode}.`,
    mode,
    configSchemaVersion: 1,
    modeConfig: mode === "survival" ? { lives: 3 } : {},
  },
  questions: questions.slice(4).map((question, index) => {
    const { modeConfig: _modeConfig, ...questionContent } = question;
    return {
      ...questionContent,
      slug: `s15-${mode}-${question.type}`,
      points: [34, 33, 33][index],
    };
  }),
}));

export const scenario = {
  id: "s15",

  async run({ fixture, clients, config, assert }) {
    const created = await clients.superadmin.rpc("create_superadmin_flash_draft", {
      input: {
        idempotencyKey: "integration-s15-create",
        document,
        reason: "Preparar La Pirámide S15",
      },
    });
    assert(
      !created.error && created.data?.status === "draft" && created.data?.questionCount === 7,
      "El superadmin crea un borrador de siete niveles",
    );

    await publishDraftQuestions({
      client: clients.superadmin,
      slugs: questions.map((question) => question.slug),
      idempotencyKeyPrefix: "integration-s15-publish-question",
      reason: "Publicar pregunta S15",
      assert,
    });

    const published = await clients.superadmin.rpc("publish_superadmin_flash", {
      input: {
        idempotencyKey: "integration-s15-publish",
        challengeVersionId: created.data.challengeVersionId,
        expectedUpdatedAt: created.data.updatedAt,
        reason: "Publicar La Pirámide S15",
      },
    });
    assert(
      !published.error && published.data?.status === "published",
      "El superadmin publica los siete niveles",
    );

    const scheduled = await clients.superadmin.rpc("create_superadmin_scheduled_challenge", {
      input: {
        idempotencyKey: "integration-s15-schedule",
        seasonId: fixture.data.seasonId,
        challengeVersionId: created.data.challengeVersionId,
        number: 1,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 3_600_000).toISOString(),
        reason: "Programar La Pirámide S15",
      },
    });
    assert(
      !scheduled.error && scheduled.data?.status === "scheduled",
      "El superadmin programa La Pirámide",
    );

    const sharedGatePublications = [];
    for (const [index, modeDocument] of sharedGateDocuments.entries()) {
      const prefix = `integration-s15-${modeDocument.challenge.mode}`;
      const modeDraft = await clients.superadmin.rpc("create_superadmin_flash_draft", {
        input: {
          idempotencyKey: `${prefix}-create`,
          document: modeDocument,
          reason: `Preparar formatos S15 para ${modeDocument.challenge.mode}`,
        },
      });
      assert(
        !modeDraft.error && modeDraft.data?.questionCount === 3,
        `El portal crea tres preguntas nuevas para ${modeDocument.challenge.mode}`,
      );
      await publishDraftQuestions({
        client: clients.superadmin,
        slugs: modeDocument.questions.map((question) => question.slug),
        idempotencyKeyPrefix: `${prefix}-publish-question`,
        reason: `Publicar formatos S15 para ${modeDocument.challenge.mode}`,
        assert,
      });
      const modePublished = await clients.superadmin.rpc("publish_superadmin_flash", {
        input: {
          idempotencyKey: `${prefix}-publish`,
          challengeVersionId: modeDraft.data.challengeVersionId,
          expectedUpdatedAt: modeDraft.data.updatedAt,
          reason: `Publicar formatos S15 para ${modeDocument.challenge.mode}`,
        },
      });
      assert(
        !modePublished.error && modePublished.data?.status === "published",
        `El gate compartido publica Zip, Escape y Word Hashtag en ${modeDocument.challenge.mode}`,
      );
      const modeScheduled = await clients.superadmin.rpc("create_superadmin_scheduled_challenge", {
        input: {
          idempotencyKey: `${prefix}-schedule`,
          seasonId: fixture.data.seasonId,
          challengeVersionId: modeDraft.data.challengeVersionId,
          number: index + 2,
          opensAt: new Date(Date.now() + (index + 1) * 7_200_000).toISOString(),
          closesAt: new Date(Date.now() + (index + 2) * 7_200_000).toISOString(),
          reason: `Programar formatos S15 para ${modeDocument.challenge.mode}`,
        },
      });
      assert(
        !modeScheduled.error && modeScheduled.data?.status === "scheduled",
        `El calendario programa el desafío ${modeDocument.challenge.mode}`,
      );
      sharedGatePublications.push({
        mode: modeDocument.challenge.mode,
        id: modeScheduled.data?.scheduledChallengeId,
      });
    }

    await dockerSql(
      `set role service_role; select private.run_calendar_tick_command(jsonb_build_object('runId','integration-s15-tick'));`,
      config.dbContainer,
    );

    const calendar = await rpc(clients.member, "get_room_calendar", {
      target_room_slug: fixture.data.roomSlug,
    });
    const publication = calendar.find(
      (entry) => entry.publication_id === scheduled.data?.scheduledChallengeId,
    );
    assert(publication?.can_start === true, "El miembro ve los siete niveles como jugables");

    assert(
      sharedGatePublications.length === 2,
      "El calendario conserva las publicaciones futuras Flash y Supervivencia sin solapar la Pirámide abierta",
    );

    const playable = await clients.member.rpc("get_my_pyramid_challenge", {
      target_room_slug: fixture.data.roomSlug,
      target_publication_id: scheduled.data.scheduledChallengeId,
    });
    assert(
      !playable.error && playable.data?.length === 7,
      "El miembro recibe siete posiciones de nivel",
    );
    assert(
      playable.data?.every(
        (row, index) =>
          row.challenge_mode === "pyramid" &&
          row.item_position === index + 1 &&
          row.level_id === `level-${index + 1}` &&
          row.briefing_title === `Briefing ${index + 1}`,
      ),
      "La proyección ordena levelId y briefings sin enviar preguntas ni soluciones",
    );
    assert(
      !JSON.stringify(playable.data).includes("S15 nivel") &&
        !JSON.stringify(playable.data).includes("correctAnswer"),
      "La lectura de juego solo expone la metadata de niveles",
    );

    const spectator = await clients.spectator.rpc("get_my_pyramid_challenge", {
      target_room_slug: fixture.data.roomSlug,
      target_publication_id: scheduled.data.scheduledChallengeId,
    });
    assert(
      !spectator.error && spectator.data?.length === 0,
      "El spectator no recibe contenido jugable",
    );
    const memberEditorial = await clients.member.rpc("get_superadmin_editorial_context");
    assert(Boolean(memberEditorial.error), "Un miembro no puede acceder al editor de desafíos");
  },
};

export default scenario;
