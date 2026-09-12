import { CONTENT_CREATED_AT, CONTENT_PUBLISHED_AT, demoIdentity } from "@/data/mock/constants";
import { mockId, durationMs } from "@/data/mock/identity";
import { questionsById as legacyQuestionsById } from "@/data/questions";
import type {
  StoredPrivateQuestionPayload,
  StoredPublicQuestionPayload,
  TypedQuestionVersion,
} from "@/types/contracts";
import type { QuestionDefinition, QuestionVersion } from "@/types/domain";
import type { Question, QuestionType } from "@/types/question";

type StoredFixture<Type extends QuestionType> = {
  readonly type: Type;
  readonly publicPayload: StoredPublicQuestionPayload<Type>;
  readonly solutionPayload: StoredPrivateQuestionPayload<Type>;
};

/** Construye una versión persistible y conserva el vínculo exhaustivo con QuestionContractMap. */
export function defineQuestionFixture<Type extends QuestionType>(
  slug: string,
  fixture: StoredFixture<Type>,
): TypedQuestionVersion<Type> {
  return {
    id: mockId.questionVersion(`${slug}:v1`),
    questionDefinitionId: mockId.questionDefinition(slug),
    versionNumber: 1,
    status: "published",
    type: fixture.type,
    publicPayload: fixture.publicPayload,
    solutionPayload: fixture.solutionPayload,
    createdByPlayerId: demoIdentity.superadminPlayerId,
    publishedAt: CONTENT_PUBLISHED_AT,
    createdAt: CONTENT_CREATED_AT,
    updatedAt: CONTENT_PUBLISHED_AT,
  };
}

function tagsFor(question: Question) {
  return {
    domains: question.tags.domains,
    topics: question.tags.topics,
    cognitiveSkills: question.tags.cognitiveSkills,
    formatSkills: question.tags.formatSkills,
    lifeSkills: question.tags.lifeSkills ?? [],
  };
}

function omitFixtureKeys<Value extends object, Key extends keyof Value>(
  value: Value,
  ...keys: readonly Key[]
): Omit<Value, Key> {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

export function normalizeLegacyQuestionFixture(question: Question): StoredFixture<QuestionType> {
  const base = {
    category: question.category,
    tags: tagsFor(question),
    prompt: question.question,
    context: question.questionContext ?? null,
    timeLimitMs: durationMs(question.timeLimit * 1_000),
  };
  const solutionBase = { explanation: question.explanation };

  switch (question.type) {
    case "multiple-choice":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            options: question.options,
            media: question.media ?? null,
            promptVisual: question.promptVisual ?? null,
          },
        },
        solutionPayload: {
          solution: { ...solutionBase, payload: { correctAnswer: question.correctAnswer } },
          reveals: [],
        },
      };
    case "odd-one-out":
      return {
        type: question.type,
        publicPayload: { ...base, payload: { items: question.items } },
        solutionPayload: {
          solution: { ...solutionBase, payload: { correctAnswer: question.correctAnswer } },
          reveals: [],
        },
      };
    case "matching":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            leftItems: question.leftItems.map((item) => omitFixtureKeys(item, "correctMatchId")),
            rightItems: question.rightItems,
          },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              matches: Object.fromEntries(
                question.leftItems.map((item) => [item.id, item.correctMatchId]),
              ),
            },
          },
          reveals: [],
        },
      };
    case "connect-pairs":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: { grid: question.grid, pairs: question.pairs, requireFullCoverage: true },
        },
        solutionPayload: {
          solution: { ...solutionBase, payload: { paths: question.solutionPaths } },
          reveals: [],
        },
      };
    case "true-false":
      return {
        type: question.type,
        publicPayload: { ...base, payload: null },
        solutionPayload: {
          solution: { ...solutionBase, payload: { correctAnswer: question.correctAnswer } },
          reveals: [],
        },
      };
    case "short-text":
      return {
        type: question.type,
        publicPayload: { ...base, payload: null },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              correctAnswer: question.correctAnswer,
              acceptedAnswers: question.acceptedAnswers ?? [],
            },
          },
          reveals: [],
        },
      };
    case "progressive-clues":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: { clueCount: question.clues.length, cluePenalty: question.cluePenalty },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              correctAnswer: question.correctAnswer,
              acceptedAnswers: question.acceptedAnswers ?? [],
            },
          },
          reveals: question.clues.map((clue, clueIndex) => ({ clueIndex, clue })),
        },
      };
    case "progressive-image": {
      const publicSurface = omitFixtureKeys(question.surface, "src");
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            surface: publicSurface,
            revealDurationMs: durationMs(question.revealDuration),
            answerLabel: question.answerLabel ?? null,
            answerPlaceholder: question.answerPlaceholder ?? null,
          },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              correctAnswer: question.correctAnswer,
              acceptedAnswers: question.acceptedAnswers ?? [],
              solutionAlt: question.solutionAlt,
            },
          },
          reveals: [{ surface: question.surface }],
        },
      };
    }
    case "heat-map":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: { surface: question.surface, targetLabel: question.targetLabel },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              target: question.target,
              fullCreditRadius: question.fullCreditRadius,
              toleranceRadius: question.toleranceRadius,
            },
          },
          reveals: [],
        },
      };
    case "image-labeling":
      if (question.task === "assign-all") {
        return {
          type: question.type,
          publicPayload: {
            ...base,
            payload: {
              task: "assign-all",
              surface: question.surface,
              anchors: question.anchors.map((anchor) => omitFixtureKeys(anchor, "correctLabelId")),
              labels: question.labels,
            },
          },
          solutionPayload: {
            solution: {
              ...solutionBase,
              payload: {
                task: "assign-all",
                labelsByAnchorId: Object.fromEntries(
                  question.anchors.map((anchor) => [anchor.id, anchor.correctLabelId]),
                ),
              },
            },
            reveals: [],
          },
        };
      }
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            task: "identify-one",
            surface: question.surface,
            target: question.target,
            response:
              question.response.kind === "choice"
                ? { kind: "choice", options: question.response.options }
                : { kind: "text" },
          },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              task: "identify-one",
              correctAnswer: question.response.correctAnswer,
              acceptedAnswers:
                question.response.kind === "text" ? (question.response.acceptedAnswers ?? []) : [],
            },
          },
          reveals: [],
        },
      };
    case "ordering":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: { items: question.items, directionLabels: question.directionLabels ?? null },
        },
        solutionPayload: {
          solution: { ...solutionBase, payload: { correctOrder: question.correctOrder } },
          reveals: [],
        },
      };
    case "classification":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            items: question.items.map((item) => omitFixtureKeys(item, "correctCategory")),
            categories: question.categories,
          },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              categoriesByItem: Object.fromEntries(
                question.items.map((item) => [item.label, item.correctCategory]),
              ),
            },
          },
          reveals: [],
        },
      };
    case "flash-memory":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            revealDurationMs: durationMs(question.revealDuration),
            grid: question.grid,
            items: question.items.map((item) => omitFixtureKeys(item, "correctPosition")),
          },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              positionsByItemId: Object.fromEntries(
                question.items.map((item) => [item.id, item.correctPosition]),
              ),
            },
          },
          reveals: [{ items: question.items }],
        },
      };
    case "memory-pairs":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            grid: question.grid,
            tiles: question.tiles.map(({ id }) => ({ id })),
            mismatchRevealDurationMs:
              question.mismatchRevealDuration == null
                ? null
                : durationMs(question.mismatchRevealDuration),
          },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              pairByTileId: Object.fromEntries(
                question.tiles.map((tile) => [tile.id, tile.pairId]),
              ),
            },
          },
          reveals: question.tiles.map((tile) => ({
            tile: omitFixtureKeys(tile, "pairId"),
          })),
        },
      };
    case "simon-sequence":
      return {
        type: question.type,
        publicPayload: { ...base, payload: { pads: question.pads } },
        solutionPayload: {
          solution: { ...solutionBase, payload: { sequence: question.sequence } },
          reveals: [{ sequence: question.sequence }],
        },
      };
    case "logic-matrix":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            pieces: question.pieces,
            cells: question.cells,
            optionIds: question.optionIds,
            showPieceLabels: question.showPieceLabels ?? null,
          },
        },
        solutionPayload: {
          solution: { ...solutionBase, payload: { correctOptionId: question.correctOptionId } },
          reveals: [],
        },
      };
    case "mini-sudoku":
      return {
        type: question.type,
        publicPayload: { ...base, payload: { grid: question.grid } },
        solutionPayload: {
          solution: { ...solutionBase, payload: { solution: question.solution } },
          reveals: [],
        },
      };
    case "mini-nonogram":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: { rowClues: question.rowClues, columnClues: question.columnClues },
        },
        solutionPayload: {
          solution: { ...solutionBase, payload: { solution: question.solution } },
          reveals: [],
        },
      };
    case "queens":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            grid: question.grid,
            regions: question.regions,
            prefilledQueens: question.prefilledQueens ?? [],
          },
        },
        solutionPayload: {
          solution: { ...solutionBase, payload: { solution: question.solution } },
          reveals: [],
        },
      };
    case "time-maze":
      return {
        type: question.type,
        publicPayload: { ...base, payload: { grid: question.grid, cells: question.cells } },
        solutionPayload: {
          solution: { ...solutionBase, payload: null },
          reveals: [],
        },
      };
    case "zip":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            grid: question.grid,
            checkpoints: question.checkpoints,
            instruction: question.instruction ?? null,
            mapNote: question.mapNote ?? null,
            boardLabel: question.boardLabel ?? null,
          },
        },
        solutionPayload: {
          solution: { ...solutionBase, payload: { solution: question.solution } },
          reveals: [],
        },
      };
    case "pipes":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            grid: question.grid,
            tiles: question.tiles,
            initialRotations: question.initialRotations,
            source: question.source,
          },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: { solutionRotations: question.solutionRotations },
          },
          reveals: [],
        },
      };
    case "sliding-puzzle":
      return {
        type: question.type,
        publicPayload: { ...base, payload: { initialTiles: question.initialTiles } },
        solutionPayload: {
          solution: { ...solutionBase, payload: { solution: question.solution } },
          reveals: [],
        },
      };
    case "escape":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            grid: question.grid,
            initialBlocks: question.initialBlocks,
            instruction: question.instruction ?? null,
            hideInstruction: question.hideInstruction ?? false,
            objectiveLabel: question.objectiveLabel ?? null,
            hideObjectiveLabel: question.hideObjectiveLabel ?? false,
            completionMessage: question.completionMessage ?? null,
            boardLabel: question.boardLabel ?? null,
          },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              referenceSolution: question.referenceSolution,
              optimalMoves: question.optimalMoves,
            },
          },
          reveals: [],
        },
      };
    case "error-reconstruction":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            steps: question.steps,
            correctionOptions: question.correction?.options ?? [],
            instruction: question.instruction ?? null,
            correctionLabel: question.correctionLabel ?? null,
            correctionRequired: question.correctionRequired ?? false,
            submitLabel: question.submitLabel ?? null,
          },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              firstErrorStepId: question.firstErrorStepId,
              correctCorrection: question.correction?.correctAnswer ?? null,
            },
          },
          reveals: [],
        },
      };
    case "anagram":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: { tiles: question.tiles, hint: question.hint ?? null },
        },
        solutionPayload: {
          solution: { ...solutionBase, payload: { correctAnswer: question.correctAnswer } },
          reveals: [],
        },
      };
    case "word-hashtag":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            grid: question.grid,
            initialLetters: question.initialLetters,
            maxMoves: question.maxMoves,
          },
        },
        solutionPayload: {
          solution: { ...solutionBase, payload: { words: question.words } },
          reveals: [],
        },
      };
    case "word-search":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            grid: question.grid,
            letters: question.letters,
            targets: question.targets.map(({ id, word }) => ({ id, word })),
          },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              positionsByTargetId: Object.fromEntries(
                question.targets.map(({ id, startCell, endCell }) => [id, { startCell, endCell }]),
              ),
            },
          },
          reveals: [],
        },
      };
    case "mini-wordle":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            hint: question.hint ?? null,
            wordLength: question.wordLength ?? 5,
            maxAttempts: question.maxAttempts ?? 6,
          },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: {
              correctAnswer: question.correctAnswer,
              additionalGuesses: question.additionalGuesses ?? [],
            },
          },
          reveals: [],
        },
      };
    case "logic-code":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: { clues: question.clues, codeLength: question.codeLength },
        },
        solutionPayload: {
          solution: { ...solutionBase, payload: { correctAnswer: question.correctAnswer } },
          reveals: [],
        },
      };
    case "estimation":
      return {
        type: question.type,
        publicPayload: {
          ...base,
          payload: {
            min: question.min,
            max: question.max,
            step: question.step,
            initialValue: question.initialValue,
            unit: question.unit,
            media: question.media ?? null,
          },
        },
        solutionPayload: {
          solution: {
            ...solutionBase,
            payload: { correctAnswer: question.correctAnswer, tolerance: question.tolerance },
          },
          reveals: [],
        },
      };
    default: {
      const exhaustive: never = question;
      throw new Error(`Unsupported question type: ${String(exhaustive)}`);
    }
  }
}

export const questionDefinitions: readonly QuestionDefinition[] = Object.keys(
  legacyQuestionsById,
).map((slug) => ({
  id: mockId.questionDefinition(slug),
  slug,
  createdByPlayerId: demoIdentity.superadminPlayerId,
  archivedAt: null,
  createdAt: CONTENT_CREATED_AT,
  updatedAt: CONTENT_PUBLISHED_AT,
}));

export const questionVersions: readonly QuestionVersion[] = Object.values(legacyQuestionsById).map(
  (question) => {
    const fixture = normalizeLegacyQuestionFixture(question);
    return defineQuestionFixture(question.id, fixture) as QuestionVersion;
  },
);

const legacyQuestionsByVersionId = new Map(
  Object.values(legacyQuestionsById).map((question) => [
    mockId.questionVersion(`${question.id}:v1`),
    question,
  ]),
);

/** Adaptador temporal: la UI aún necesita la unión pública/privada completa. */
export function reconstructLegacyQuestion(questionVersionId: QuestionVersion["id"]) {
  return legacyQuestionsByVersionId.get(questionVersionId);
}

/** Metadata exclusiva de compatibilidad; los puntos competitivos viven en ChallengeItem. */
export const legacyQuestionPoints = Object.fromEntries(
  Object.values(legacyQuestionsById).map((question) => [question.id, question.points]),
) as Readonly<Record<string, number>>;
