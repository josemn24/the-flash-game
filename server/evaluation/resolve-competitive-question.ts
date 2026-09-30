import "server-only";

import type {
  PublicQuestion,
  PublicQuestionOfType,
  QuestionReveal,
  QuestionSolution,
  QuestionSolutionOfType,
  QuestionType,
} from "@/types/contracts";
import type {
  ResolvedBaseQuestion,
  ResolvedQuestion,
  ResolvedQuestionOfType,
} from "@/types/gameplay/scoring";

type ResolvedQuestionInput<Type extends QuestionType = QuestionType> = {
  readonly publicQuestion: PublicQuestionOfType<Type>;
  readonly solution: QuestionSolutionOfType<Type>;
  readonly points: number;
  readonly reveals?: readonly QuestionReveal[];
};

type CanonicalQuestionResolutionInput = {
  readonly publicQuestion: PublicQuestion;
  readonly solution: QuestionSolution;
  readonly points: number;
  readonly reveals?: readonly QuestionReveal[];
};

function baseQuestion<Type extends QuestionType>(
  publicQuestion: PublicQuestionOfType<Type>,
  solution: QuestionSolutionOfType<Type>,
  points: number,
): ResolvedBaseQuestion {
  return {
    id: publicQuestion.id,
    category: publicQuestion.category,
    tags: publicQuestion.tags,
    question: publicQuestion.prompt,
    ...(publicQuestion.context === null ? {} : { questionContext: publicQuestion.context }),
    timeLimit: publicQuestion.timeLimitMs / 1_000,
    points,
    explanation: solution.explanation,
  };
}

function memoryPairReveals(reveals: readonly QuestionReveal[] | undefined) {
  return new Map(
    (reveals ?? [])
      .filter((reveal) => reveal.type === "memory-pairs")
      .map((reveal) => [reveal.payload.tile.id, reveal.payload.tile] as const),
  );
}

function isSolutionOfType<Type extends QuestionType>(
  solution: QuestionSolution,
  type: Type,
): solution is QuestionSolution & QuestionSolutionOfType<Type> {
  return solution.type === type;
}

function solutionFor<Type extends QuestionType>(
  solution: QuestionSolution,
  type: Type,
): QuestionSolutionOfType<Type> {
  if (!isSolutionOfType(solution, type)) {
    throw new Error(`Mismatched public and solution contracts for ${type}`);
  }

  return solution;
}

/**
 * Composes the canonical public and private contracts into the private shape
 * required by the scoring registry. This function is server-only by import
 * boundary: its result must never be sent to a client during an attempt.
 */
export function resolveCompetitiveQuestion<Type extends QuestionType>(
  input: ResolvedQuestionInput<Type>,
): ResolvedQuestionOfType<Type>;
export function resolveCompetitiveQuestion({
  publicQuestion,
  solution,
  points,
  reveals,
}: CanonicalQuestionResolutionInput): ResolvedQuestion {
  switch (publicQuestion.type) {
    case "multiple-choice":
      const multipleChoiceSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, multipleChoiceSolution, points),
        type: publicQuestion.type,
        options: [...publicQuestion.payload.options],
        ...(publicQuestion.payload.media ? { media: publicQuestion.payload.media } : {}),
        ...(publicQuestion.payload.promptVisual
          ? { promptVisual: publicQuestion.payload.promptVisual }
          : {}),
        correctAnswer: multipleChoiceSolution.payload.correctAnswer,
      } satisfies ResolvedQuestionOfType<"multiple-choice">;
    case "odd-one-out":
      const oddOneOutSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, oddOneOutSolution, points),
        type: publicQuestion.type,
        items: [...publicQuestion.payload.items],
        correctAnswer: oddOneOutSolution.payload.correctAnswer,
      } satisfies ResolvedQuestionOfType<"odd-one-out">;
    case "matching":
      const matchingSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, matchingSolution, points),
        type: publicQuestion.type,
        leftItems: publicQuestion.payload.leftItems.map((item) => ({
          ...item,
          correctMatchId: matchingSolution.payload.matches[item.id],
        })),
        rightItems: [...publicQuestion.payload.rightItems],
      } satisfies ResolvedQuestionOfType<"matching">;
    case "connect-pairs":
      const connectPairsSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, connectPairsSolution, points),
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        pairs: [...publicQuestion.payload.pairs],
        solutionPaths: Object.fromEntries(
          Object.entries(connectPairsSolution.payload.paths).map(([id, path]) => [id, [...path]]),
        ),
        requireFullCoverage: publicQuestion.payload.requireFullCoverage,
      } satisfies ResolvedQuestionOfType<"connect-pairs">;
    case "true-false":
      const trueFalseSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, trueFalseSolution, points),
        type: publicQuestion.type,
        correctAnswer: trueFalseSolution.payload.correctAnswer,
      } satisfies ResolvedQuestionOfType<"true-false">;
    case "short-text":
      const shortTextSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, shortTextSolution, points),
        type: publicQuestion.type,
        correctAnswer: shortTextSolution.payload.correctAnswer,
        acceptedAnswers: [...shortTextSolution.payload.acceptedAnswers],
      } satisfies ResolvedQuestionOfType<"short-text">;
    case "progressive-clues":
      const progressiveCluesSolution = solutionFor(solution, publicQuestion.type);
      const cluesByIndex = new Map(
        (reveals ?? [])
          .filter((reveal) => reveal.type === "progressive-clues")
          .map((reveal) => [reveal.payload.clueIndex, reveal.payload.clue] as const),
      );
      return {
        ...baseQuestion(publicQuestion, progressiveCluesSolution, points),
        type: publicQuestion.type,
        clues: Array.from(
          { length: publicQuestion.payload.clueCount },
          (_, index) => cluesByIndex.get(index) ?? `clue-${index + 1}`,
        ),
        cluePenalty: publicQuestion.payload.cluePenalty,
        correctAnswer: progressiveCluesSolution.payload.correctAnswer,
        acceptedAnswers: [...progressiveCluesSolution.payload.acceptedAnswers],
      } satisfies ResolvedQuestionOfType<"progressive-clues">;
    case "progressive-image":
      const progressiveImageSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, progressiveImageSolution, points),
        type: publicQuestion.type,
        surface: publicQuestion.payload.surface,
        solutionAlt: progressiveImageSolution.payload.solutionAlt,
        revealDuration: publicQuestion.payload.revealDurationMs / 1_000,
        correctAnswer: progressiveImageSolution.payload.correctAnswer,
        acceptedAnswers: [...progressiveImageSolution.payload.acceptedAnswers],
        ...(publicQuestion.payload.answerLabel === null
          ? {}
          : { answerLabel: publicQuestion.payload.answerLabel }),
        ...(publicQuestion.payload.answerPlaceholder === null
          ? {}
          : { answerPlaceholder: publicQuestion.payload.answerPlaceholder }),
      } satisfies ResolvedQuestionOfType<"progressive-image">;
    case "heat-map":
      const heatMapSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, heatMapSolution, points),
        type: publicQuestion.type,
        surface: publicQuestion.payload.surface,
        targetLabel: publicQuestion.payload.targetLabel,
        target: heatMapSolution.payload.target,
        fullCreditRadius: heatMapSolution.payload.fullCreditRadius,
        toleranceRadius: heatMapSolution.payload.toleranceRadius,
      } satisfies ResolvedQuestionOfType<"heat-map">;
    case "image-labeling": {
      const payload = publicQuestion.payload;
      const imageLabelingSolution = solutionFor(solution, publicQuestion.type);
      const imageSolution = imageLabelingSolution.payload;
      if (payload.task === "assign-all" && imageSolution.task === "assign-all") {
        return {
          ...baseQuestion(publicQuestion, imageLabelingSolution, points),
          type: publicQuestion.type,
          task: "assign-all",
          surface: payload.surface,
          anchors: payload.anchors.map((anchor) => ({
            ...anchor,
            correctLabelId: imageSolution.labelsByAnchorId[anchor.id],
          })),
          labels: [...payload.labels],
        } satisfies ResolvedQuestionOfType<"image-labeling">;
      }
      if (payload.task === "identify-one" && imageSolution.task === "identify-one") {
        return {
          ...baseQuestion(publicQuestion, imageLabelingSolution, points),
          type: publicQuestion.type,
          task: "identify-one",
          surface: payload.surface,
          target: payload.target,
          response:
            payload.response.kind === "choice"
              ? {
                  kind: "choice",
                  options: [...payload.response.options],
                  correctAnswer: imageSolution.correctAnswer,
                }
              : {
                  kind: "text",
                  correctAnswer: imageSolution.correctAnswer,
                  acceptedAnswers: [...imageSolution.acceptedAnswers],
                },
        } satisfies ResolvedQuestionOfType<"image-labeling">;
      }
      throw new Error("Mismatched image-labeling public and solution contracts");
    }
    case "ordering":
      const orderingSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, orderingSolution, points),
        type: publicQuestion.type,
        items: [...publicQuestion.payload.items],
        correctOrder: [...orderingSolution.payload.correctOrder],
        ...(publicQuestion.payload.directionLabels
          ? { directionLabels: publicQuestion.payload.directionLabels }
          : {}),
      } satisfies ResolvedQuestionOfType<"ordering">;
    case "classification":
      const classificationSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, classificationSolution, points),
        type: publicQuestion.type,
        categories: [...publicQuestion.payload.categories],
        items: publicQuestion.payload.items.map((item) => ({
          ...item,
          correctCategory: classificationSolution.payload.categoriesByItem[item.label],
        })),
      } satisfies ResolvedQuestionOfType<"classification">;
    case "flash-memory":
      const flashMemorySolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, flashMemorySolution, points),
        type: publicQuestion.type,
        revealDuration: publicQuestion.payload.revealDurationMs / 1_000,
        grid: publicQuestion.payload.grid,
        items: publicQuestion.payload.items.map((item) => ({
          ...item,
          correctPosition: flashMemorySolution.payload.positionsByItemId[item.id],
        })),
      } satisfies ResolvedQuestionOfType<"flash-memory">;
    case "memory-pairs": {
      const tileReveals = memoryPairReveals(reveals);
      const memoryPairsSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, memoryPairsSolution, points),
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        tiles: publicQuestion.payload.tiles.map((tile) => ({
          ...(tileReveals.get(tile.id) ?? { label: tile.id }),
          id: tile.id,
          pairId: memoryPairsSolution.payload.pairByTileId[tile.id],
        })),
        ...(publicQuestion.payload.mismatchRevealDurationMs === null
          ? {}
          : { mismatchRevealDuration: publicQuestion.payload.mismatchRevealDurationMs / 1_000 }),
      } satisfies ResolvedQuestionOfType<"memory-pairs">;
    }
    case "simon-sequence":
      const simonSequenceSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, simonSequenceSolution, points),
        type: publicQuestion.type,
        pads: [...publicQuestion.payload.pads],
        sequence: [...simonSequenceSolution.payload.sequence],
      } satisfies ResolvedQuestionOfType<"simon-sequence">;
    case "logic-matrix":
      const logicMatrixSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, logicMatrixSolution, points),
        type: publicQuestion.type,
        pieces: [...publicQuestion.payload.pieces],
        cells: [...publicQuestion.payload.cells],
        optionIds: [...publicQuestion.payload.optionIds],
        correctOptionId: logicMatrixSolution.payload.correctOptionId,
        ...(publicQuestion.payload.showPieceLabels === null
          ? {}
          : { showPieceLabels: publicQuestion.payload.showPieceLabels }),
      } satisfies ResolvedQuestionOfType<"logic-matrix">;
    case "mini-sudoku":
      const miniSudokuSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, miniSudokuSolution, points),
        type: publicQuestion.type,
        grid: [...publicQuestion.payload.grid],
        solution: [...miniSudokuSolution.payload.solution],
      } satisfies ResolvedQuestionOfType<"mini-sudoku">;
    case "mini-nonogram":
      const miniNonogramSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, miniNonogramSolution, points),
        type: publicQuestion.type,
        rowClues: publicQuestion.payload.rowClues.map((row) => [...row]),
        columnClues: publicQuestion.payload.columnClues.map((column) => [...column]),
        solution: [...miniNonogramSolution.payload.solution],
      } satisfies ResolvedQuestionOfType<"mini-nonogram">;
    case "queens":
      const queensSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, queensSolution, points),
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        regions: [...publicQuestion.payload.regions],
        ...(publicQuestion.payload.prefilledQueens.length > 0
          ? { prefilledQueens: [...publicQuestion.payload.prefilledQueens] }
          : {}),
        solution: [...queensSolution.payload.solution],
      } satisfies ResolvedQuestionOfType<"queens">;
    case "time-maze":
      const timeMazeSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, timeMazeSolution, points),
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        cells: [...publicQuestion.payload.cells],
      } satisfies ResolvedQuestionOfType<"time-maze">;
    case "zip":
      const zipSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, zipSolution, points),
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        checkpoints: [...publicQuestion.payload.checkpoints],
        solution: [...zipSolution.payload.solution],
        ...(publicQuestion.payload.instruction === null
          ? {}
          : { instruction: publicQuestion.payload.instruction }),
        ...(publicQuestion.payload.mapNote === null
          ? {}
          : { mapNote: publicQuestion.payload.mapNote }),
        ...(publicQuestion.payload.boardLabel === null
          ? {}
          : { boardLabel: publicQuestion.payload.boardLabel }),
      } satisfies ResolvedQuestionOfType<"zip">;
    case "pipes":
      const pipesSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, pipesSolution, points),
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        tiles: [...publicQuestion.payload.tiles],
        initialRotations: [...publicQuestion.payload.initialRotations],
        source: publicQuestion.payload.source,
        solutionRotations: [...pipesSolution.payload.solutionRotations],
      } satisfies ResolvedQuestionOfType<"pipes">;
    case "sliding-puzzle":
      const slidingPuzzleSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, slidingPuzzleSolution, points),
        type: publicQuestion.type,
        initialTiles: [...publicQuestion.payload.initialTiles],
        solution: [...slidingPuzzleSolution.payload.solution],
      } satisfies ResolvedQuestionOfType<"sliding-puzzle">;
    case "escape":
      const escapeSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, escapeSolution, points),
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        initialBlocks: [...publicQuestion.payload.initialBlocks],
        referenceSolution: [...escapeSolution.payload.referenceSolution],
        optimalMoves: escapeSolution.payload.optimalMoves,
        ...(publicQuestion.payload.instruction === null
          ? {}
          : { instruction: publicQuestion.payload.instruction }),
        hideInstruction: publicQuestion.payload.hideInstruction,
        ...(publicQuestion.payload.objectiveLabel === null
          ? {}
          : { objectiveLabel: publicQuestion.payload.objectiveLabel }),
        hideObjectiveLabel: publicQuestion.payload.hideObjectiveLabel,
        ...(publicQuestion.payload.completionMessage === null
          ? {}
          : { completionMessage: publicQuestion.payload.completionMessage }),
        ...(publicQuestion.payload.boardLabel === null
          ? {}
          : { boardLabel: publicQuestion.payload.boardLabel }),
      } satisfies ResolvedQuestionOfType<"escape">;
    case "error-reconstruction":
      const errorReconstructionSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, errorReconstructionSolution, points),
        type: publicQuestion.type,
        steps: [...publicQuestion.payload.steps],
        firstErrorStepId: errorReconstructionSolution.payload.firstErrorStepId,
        ...(errorReconstructionSolution.payload.correctCorrection === null
          ? {}
          : {
              correction: {
                options: [...publicQuestion.payload.correctionOptions],
                correctAnswer: errorReconstructionSolution.payload.correctCorrection,
              },
            }),
        ...(publicQuestion.payload.instruction === null
          ? {}
          : { instruction: publicQuestion.payload.instruction }),
        ...(publicQuestion.payload.correctionLabel === null
          ? {}
          : { correctionLabel: publicQuestion.payload.correctionLabel }),
        ...(publicQuestion.payload.correctionRequired ? { correctionRequired: true } : {}),
        ...(publicQuestion.payload.submitLabel === null
          ? {}
          : { submitLabel: publicQuestion.payload.submitLabel }),
      } satisfies ResolvedQuestionOfType<"error-reconstruction">;
    case "anagram":
      const anagramSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, anagramSolution, points),
        type: publicQuestion.type,
        tiles: [...publicQuestion.payload.tiles],
        correctAnswer: anagramSolution.payload.correctAnswer,
        ...(publicQuestion.payload.hint === null ? {} : { hint: publicQuestion.payload.hint }),
      } satisfies ResolvedQuestionOfType<"anagram">;
    case "word-hashtag":
      const wordHashtagSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, wordHashtagSolution, points),
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        initialLetters: [...publicQuestion.payload.initialLetters],
        maxMoves: publicQuestion.payload.maxMoves,
        words: wordHashtagSolution.payload.words,
      } satisfies ResolvedQuestionOfType<"word-hashtag">;
    case "word-search":
      const wordSearchSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, wordSearchSolution, points),
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        letters: [...publicQuestion.payload.letters],
        targets: publicQuestion.payload.targets.map((target) => ({
          ...target,
          ...wordSearchSolution.payload.positionsByTargetId[target.id],
        })),
      } satisfies ResolvedQuestionOfType<"word-search">;
    case "mini-wordle":
      const miniWordleSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, miniWordleSolution, points),
        type: publicQuestion.type,
        correctAnswer: miniWordleSolution.payload.correctAnswer,
        additionalGuesses: [...miniWordleSolution.payload.additionalGuesses],
        dictionaryId: miniWordleSolution.payload.dictionaryId,
        ...(publicQuestion.payload.hint === null ? {} : { hint: publicQuestion.payload.hint }),
        wordLength: publicQuestion.payload.wordLength,
        maxAttempts: publicQuestion.payload.maxAttempts,
      } satisfies ResolvedQuestionOfType<"mini-wordle">;
    case "logic-code":
      const logicCodeSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, logicCodeSolution, points),
        type: publicQuestion.type,
        clues: [...publicQuestion.payload.clues],
        codeLength: publicQuestion.payload.codeLength,
        correctAnswer: logicCodeSolution.payload.correctAnswer,
      } satisfies ResolvedQuestionOfType<"logic-code">;
    case "estimation":
      const estimationSolution = solutionFor(solution, publicQuestion.type);
      const { media, ...estimationPayload } = publicQuestion.payload;
      return {
        ...baseQuestion(publicQuestion, estimationSolution, points),
        type: publicQuestion.type,
        ...estimationPayload,
        ...(media === null ? {} : { media }),
        correctAnswer: estimationSolution.payload.correctAnswer,
        tolerance: estimationSolution.payload.tolerance,
      } satisfies ResolvedQuestionOfType<"estimation">;
    default: {
      const exhaustive: never = publicQuestion;
      throw new Error(`Unsupported competitive question: ${String(exhaustive)}`);
    }
  }
}

export type { CanonicalQuestionResolutionInput as CompetitiveQuestionResolutionInput };
