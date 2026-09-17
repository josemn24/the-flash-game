import {
  publishedQuestionFixtures,
  type MockPublishedQuestion,
} from "@/data/mock/catalog/questions";
import { questionVersions } from "@/data/mock/questionFixtures";
import type { AnyMockPublishedQuestion } from "@/data/mock/catalog/questions/definition";
import { durationMs, mockId } from "@/data/mock/identity";
import { assertSupportedQuestionPayloadSchemaVersion } from "@/types/contracts";
import type { StoredPrivateQuestionPayload, StoredPublicQuestionPayload } from "@/types/contracts";
import type { QuestionVersion } from "@/types/domain";
import type { Question, QuestionType } from "@/types/question";

type StoredFixture<Type extends QuestionType> = {
  readonly type: Type;
  readonly publicPayload: StoredPublicQuestionPayload<Type>;
  readonly solutionPayload: StoredPrivateQuestionPayload<Type>;
};

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
              ...(question.dictionaryId ? { dictionaryId: question.dictionaryId } : {}),
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

function optional<Key extends string, Value>(key: Key, value: Value | null) {
  return value === null ? {} : ({ [key]: value } as Record<Key, Value>);
}

function baseFor(fixture: AnyMockPublishedQuestion) {
  const { publicPayload, privatePayload } = fixture;
  const { tags } = publicPayload;
  return {
    id: fixture.slug,
    category: publicPayload.category,
    tags: {
      domains: [...tags.domains],
      topics: [...tags.topics],
      cognitiveSkills: [...tags.cognitiveSkills],
      formatSkills: [...tags.formatSkills],
      ...(tags.lifeSkills.length > 0 ? { lifeSkills: [...tags.lifeSkills] } : {}),
    },
    question: publicPayload.prompt,
    ...optional("questionContext", publicPayload.context),
    timeLimit: publicPayload.timeLimitMs / 1_000,
    points: fixture.practicePoints,
    explanation: privatePayload.solution.explanation,
  };
}

function asLegacy(value: unknown) {
  return value as Question;
}

/** Proyecta el contrato público/privado canónico al agregado requerido por la UI de la PoC. */
export function projectLegacyQuestion(fixture: AnyMockPublishedQuestion): Question {
  const base = baseFor(fixture);
  switch (fixture.type) {
    case "multiple-choice":
      return asLegacy({
        ...base,
        type: fixture.type,
        options: [...fixture.publicPayload.payload.options],
        ...optional("media", fixture.publicPayload.payload.media),
        ...optional("promptVisual", fixture.publicPayload.payload.promptVisual),
        correctAnswer: fixture.privatePayload.solution.payload.correctAnswer,
      });
    case "odd-one-out":
      return asLegacy({
        ...base,
        type: fixture.type,
        items: [...fixture.publicPayload.payload.items],
        correctAnswer: fixture.privatePayload.solution.payload.correctAnswer,
      });
    case "matching":
      return asLegacy({
        ...base,
        type: fixture.type,
        leftItems: fixture.publicPayload.payload.leftItems.map((item) => ({
          ...item,
          correctMatchId: fixture.privatePayload.solution.payload.matches[item.id],
        })),
        rightItems: [...fixture.publicPayload.payload.rightItems],
      });
    case "connect-pairs":
      return asLegacy({
        ...base,
        type: fixture.type,
        grid: fixture.publicPayload.payload.grid,
        pairs: [...fixture.publicPayload.payload.pairs],
        requireFullCoverage: true,
        solutionPaths: fixture.privatePayload.solution.payload.paths,
      });
    case "true-false":
      return asLegacy({
        ...base,
        type: fixture.type,
        correctAnswer: fixture.privatePayload.solution.payload.correctAnswer,
      });
    case "short-text": {
      const solution = fixture.privatePayload.solution.payload;
      return asLegacy({
        ...base,
        type: fixture.type,
        correctAnswer: solution.correctAnswer,
        ...(solution.acceptedAnswers.length > 0
          ? { acceptedAnswers: [...solution.acceptedAnswers] }
          : {}),
      });
    }
    case "progressive-clues": {
      const solution = fixture.privatePayload.solution.payload;
      return asLegacy({
        ...base,
        type: fixture.type,
        clues: [...fixture.privatePayload.reveals]
          .sort((left, right) => left.clueIndex - right.clueIndex)
          .map(({ clue }) => clue),
        cluePenalty: fixture.publicPayload.payload.cluePenalty,
        correctAnswer: solution.correctAnswer,
        ...(solution.acceptedAnswers.length > 0
          ? { acceptedAnswers: [...solution.acceptedAnswers] }
          : {}),
      });
    }
    case "progressive-image": {
      const solution = fixture.privatePayload.solution.payload;
      const reveal = fixture.privatePayload.reveals[0];
      if (!reveal) throw new Error(`Missing progressive image reveal for "${fixture.slug}".`);
      return asLegacy({
        ...base,
        type: fixture.type,
        surface: reveal.surface,
        solutionAlt: solution.solutionAlt,
        revealDuration: fixture.publicPayload.payload.revealDurationMs,
        correctAnswer: solution.correctAnswer,
        ...(solution.acceptedAnswers.length > 0
          ? { acceptedAnswers: [...solution.acceptedAnswers] }
          : {}),
        ...optional("answerLabel", fixture.publicPayload.payload.answerLabel),
        ...optional("answerPlaceholder", fixture.publicPayload.payload.answerPlaceholder),
      });
    }
    case "heat-map":
      return asLegacy({
        ...base,
        type: fixture.type,
        surface: fixture.publicPayload.payload.surface,
        targetLabel: fixture.publicPayload.payload.targetLabel,
        ...fixture.privatePayload.solution.payload,
      });
    case "image-labeling": {
      const publicPayload = fixture.publicPayload.payload;
      const solution = fixture.privatePayload.solution.payload;
      if (publicPayload.task === "assign-all" && solution.task === "assign-all") {
        return asLegacy({
          ...base,
          type: fixture.type,
          task: "assign-all",
          surface: publicPayload.surface,
          anchors: publicPayload.anchors.map((anchor) => ({
            ...anchor,
            correctLabelId: solution.labelsByAnchorId[anchor.id],
          })),
          labels: [...publicPayload.labels],
        });
      }
      if (publicPayload.task === "identify-one" && solution.task === "identify-one") {
        return asLegacy({
          ...base,
          type: fixture.type,
          task: "identify-one",
          surface: publicPayload.surface,
          target: publicPayload.target,
          response:
            publicPayload.response.kind === "choice"
              ? {
                  kind: "choice",
                  options: [...publicPayload.response.options],
                  correctAnswer: solution.correctAnswer,
                }
              : {
                  kind: "text",
                  correctAnswer: solution.correctAnswer,
                  ...(solution.acceptedAnswers.length > 0
                    ? { acceptedAnswers: [...solution.acceptedAnswers] }
                    : {}),
                },
        });
      }
      throw new Error(`Mismatched image-labeling payload for "${fixture.slug}".`);
    }
    case "ordering":
      return asLegacy({
        ...base,
        type: fixture.type,
        items: [...fixture.publicPayload.payload.items],
        correctOrder: [...fixture.privatePayload.solution.payload.correctOrder],
        ...optional("directionLabels", fixture.publicPayload.payload.directionLabels),
      });
    case "classification":
      return asLegacy({
        ...base,
        type: fixture.type,
        categories: [...fixture.publicPayload.payload.categories],
        items: fixture.publicPayload.payload.items.map((item) => ({
          ...item,
          correctCategory: fixture.privatePayload.solution.payload.categoriesByItem[item.label],
        })),
      });
    case "flash-memory": {
      const reveal = fixture.privatePayload.reveals[0];
      if (!reveal) throw new Error(`Missing flash-memory reveal for "${fixture.slug}".`);
      return asLegacy({
        ...base,
        type: fixture.type,
        revealDuration: fixture.publicPayload.payload.revealDurationMs,
        grid: fixture.publicPayload.payload.grid,
        items: [...reveal.items],
      });
    }
    case "memory-pairs": {
      const reveals = new Map(
        fixture.privatePayload.reveals.map(({ tile }) => [tile.id, tile] as const),
      );
      return asLegacy({
        ...base,
        type: fixture.type,
        grid: fixture.publicPayload.payload.grid,
        tiles: fixture.publicPayload.payload.tiles.map(({ id }) => ({
          ...reveals.get(id),
          id,
          pairId: fixture.privatePayload.solution.payload.pairByTileId[id],
        })),
        ...optional(
          "mismatchRevealDuration",
          fixture.publicPayload.payload.mismatchRevealDurationMs,
        ),
      });
    }
    case "simon-sequence":
      return asLegacy({
        ...base,
        type: fixture.type,
        pads: [...fixture.publicPayload.payload.pads],
        sequence: [...fixture.privatePayload.solution.payload.sequence],
      });
    case "logic-matrix":
      return asLegacy({
        ...base,
        type: fixture.type,
        pieces: [...fixture.publicPayload.payload.pieces],
        cells: [...fixture.publicPayload.payload.cells],
        optionIds: [...fixture.publicPayload.payload.optionIds],
        correctOptionId: fixture.privatePayload.solution.payload.correctOptionId,
        ...optional("showPieceLabels", fixture.publicPayload.payload.showPieceLabels),
      });
    case "mini-sudoku":
      return asLegacy({
        ...base,
        type: fixture.type,
        grid: [...fixture.publicPayload.payload.grid],
        solution: [...fixture.privatePayload.solution.payload.solution],
      });
    case "mini-nonogram":
      return asLegacy({
        ...base,
        type: fixture.type,
        rowClues: fixture.publicPayload.payload.rowClues.map((row) => [...row]),
        columnClues: fixture.publicPayload.payload.columnClues.map((column) => [...column]),
        solution: [...fixture.privatePayload.solution.payload.solution],
      });
    case "queens":
      return asLegacy({
        ...base,
        type: fixture.type,
        grid: fixture.publicPayload.payload.grid,
        regions: [...fixture.publicPayload.payload.regions],
        ...(fixture.publicPayload.payload.prefilledQueens.length > 0
          ? { prefilledQueens: [...fixture.publicPayload.payload.prefilledQueens] }
          : {}),
        solution: [...fixture.privatePayload.solution.payload.solution],
      });
    case "time-maze":
      return asLegacy({
        ...base,
        type: fixture.type,
        grid: fixture.publicPayload.payload.grid,
        cells: [...fixture.publicPayload.payload.cells],
      });
    case "zip":
      return asLegacy({
        ...base,
        type: fixture.type,
        grid: fixture.publicPayload.payload.grid,
        checkpoints: [...fixture.publicPayload.payload.checkpoints],
        solution: [...fixture.privatePayload.solution.payload.solution],
        ...optional("instruction", fixture.publicPayload.payload.instruction),
        ...optional("mapNote", fixture.publicPayload.payload.mapNote),
        ...optional("boardLabel", fixture.publicPayload.payload.boardLabel),
      });
    case "pipes":
      return asLegacy({
        ...base,
        type: fixture.type,
        grid: fixture.publicPayload.payload.grid,
        tiles: [...fixture.publicPayload.payload.tiles],
        initialRotations: [...fixture.publicPayload.payload.initialRotations],
        source: fixture.publicPayload.payload.source,
        solutionRotations: [...fixture.privatePayload.solution.payload.solutionRotations],
      });
    case "sliding-puzzle":
      return asLegacy({
        ...base,
        type: fixture.type,
        initialTiles: [...fixture.publicPayload.payload.initialTiles],
        solution: [...fixture.privatePayload.solution.payload.solution],
      });
    case "escape":
      return asLegacy({
        ...base,
        type: fixture.type,
        grid: fixture.publicPayload.payload.grid,
        initialBlocks: [...fixture.publicPayload.payload.initialBlocks],
        ...optional("instruction", fixture.publicPayload.payload.instruction),
        ...(fixture.publicPayload.payload.hideInstruction ? { hideInstruction: true } : {}),
        ...optional("objectiveLabel", fixture.publicPayload.payload.objectiveLabel),
        ...(fixture.publicPayload.payload.hideObjectiveLabel ? { hideObjectiveLabel: true } : {}),
        ...optional("completionMessage", fixture.publicPayload.payload.completionMessage),
        ...optional("boardLabel", fixture.publicPayload.payload.boardLabel),
        referenceSolution: [...fixture.privatePayload.solution.payload.referenceSolution],
        optimalMoves: fixture.privatePayload.solution.payload.optimalMoves,
      });
    case "error-reconstruction": {
      const publicPayload = fixture.publicPayload.payload;
      const solution = fixture.privatePayload.solution.payload;
      return asLegacy({
        ...base,
        type: fixture.type,
        steps: [...publicPayload.steps],
        firstErrorStepId: solution.firstErrorStepId,
        ...(solution.correctCorrection !== null
          ? {
              correction: {
                options: [...publicPayload.correctionOptions],
                correctAnswer: solution.correctCorrection,
              },
            }
          : {}),
        ...optional("instruction", publicPayload.instruction),
        ...optional("correctionLabel", publicPayload.correctionLabel),
        ...(publicPayload.correctionRequired ? { correctionRequired: true } : {}),
        ...optional("submitLabel", publicPayload.submitLabel),
      });
    }
    case "anagram":
      return asLegacy({
        ...base,
        type: fixture.type,
        tiles: [...fixture.publicPayload.payload.tiles],
        correctAnswer: fixture.privatePayload.solution.payload.correctAnswer,
        ...optional("hint", fixture.publicPayload.payload.hint),
      });
    case "word-hashtag":
      return asLegacy({
        ...base,
        type: fixture.type,
        grid: fixture.publicPayload.payload.grid,
        initialLetters: [...fixture.publicPayload.payload.initialLetters],
        maxMoves: fixture.publicPayload.payload.maxMoves,
        words: fixture.privatePayload.solution.payload.words,
      });
    case "word-search":
      return asLegacy({
        ...base,
        type: fixture.type,
        grid: fixture.publicPayload.payload.grid,
        letters: [...fixture.publicPayload.payload.letters],
        targets: fixture.publicPayload.payload.targets.map((target) => ({
          ...target,
          ...fixture.privatePayload.solution.payload.positionsByTargetId[target.id],
        })),
      });
    case "mini-wordle": {
      const solution = fixture.privatePayload.solution.payload;
      return asLegacy({
        ...base,
        type: fixture.type,
        correctAnswer: solution.correctAnswer,
        ...(solution.additionalGuesses.length > 0
          ? { additionalGuesses: [...solution.additionalGuesses] }
          : {}),
        ...optional("dictionaryId", solution.dictionaryId),
        ...optional("hint", fixture.publicPayload.payload.hint),
        wordLength: fixture.publicPayload.payload.wordLength,
        maxAttempts: fixture.publicPayload.payload.maxAttempts,
      });
    }
    case "logic-code":
      return asLegacy({
        ...base,
        type: fixture.type,
        clues: [...fixture.publicPayload.payload.clues],
        codeLength: fixture.publicPayload.payload.codeLength,
        correctAnswer: fixture.privatePayload.solution.payload.correctAnswer,
      });
    case "estimation":
      return asLegacy({
        ...base,
        type: fixture.type,
        ...fixture.publicPayload.payload,
        ...optional("media", fixture.publicPayload.payload.media),
        correctAnswer: fixture.privatePayload.solution.payload.correctAnswer,
        tolerance: fixture.privatePayload.solution.payload.tolerance,
      });
    default: {
      const exhaustive: never = fixture;
      throw new Error(`Unsupported canonical question: ${String(exhaustive)}`);
    }
  }
}

const fixturesByVersionId = new Map(
  publishedQuestionFixtures.map((fixture) => [
    mockId.questionVersion(`${fixture.slug}:v1`),
    fixture as MockPublishedQuestion,
  ]),
);

type LegacyQuestionsBySlug = {
  readonly [Fixture in (typeof publishedQuestionFixtures)[number] as Fixture["slug"]]: Extract<
    Question,
    { type: Fixture["type"] }
  >;
};

export const legacyQuestionsBySlug = Object.fromEntries(
  publishedQuestionFixtures.map((fixture) => [fixture.slug, projectLegacyQuestion(fixture)]),
) as LegacyQuestionsBySlug;

/** Adaptador temporal: la UI aún necesita la unión pública/privada completa. */
export function reconstructLegacyQuestion(questionVersionId: QuestionVersion["id"]) {
  const version = questionVersions.find((candidate) => candidate.id === questionVersionId);
  if (version) assertSupportedQuestionPayloadSchemaVersion(version.payloadSchemaVersion);
  const fixture = fixturesByVersionId.get(questionVersionId);
  return fixture ? projectLegacyQuestion(fixture as AnyMockPublishedQuestion) : undefined;
}

/** Metadata exclusiva de compatibilidad; los puntos competitivos viven en ChallengeItem. */
export const legacyQuestionPoints = Object.fromEntries(
  publishedQuestionFixtures.map((fixture) => [fixture.slug, fixture.practicePoints]),
) as Readonly<Record<string, number>>;
