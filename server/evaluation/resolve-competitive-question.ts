import "server-only";

import type {
  PublicQuestion,
  PublicQuestionOfType,
  QuestionReveal,
  QuestionSolution,
  QuestionSolutionOfType,
  QuestionType,
} from "@/types/contracts";
import type { ResolvedQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";

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

function baseQuestion(publicQuestion: PublicQuestion, solution: QuestionSolution, points: number) {
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

function solutionFor<Type extends QuestionType>(
  solution: QuestionSolution,
  type: Type,
): QuestionSolutionOfType<Type> {
  if (solution.type !== type) {
    throw new Error(`Mismatched public and solution contracts for ${type}`);
  }

  return solution as QuestionSolutionOfType<Type>;
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
  const base = baseQuestion(publicQuestion, solution, points);

  switch (publicQuestion.type) {
    case "multiple-choice":
      const multipleChoiceSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        options: [...publicQuestion.payload.options],
        ...(publicQuestion.payload.media ? { media: publicQuestion.payload.media } : {}),
        ...(publicQuestion.payload.promptVisual
          ? { promptVisual: publicQuestion.payload.promptVisual }
          : {}),
        correctAnswer: multipleChoiceSolution.payload.correctAnswer,
      } as ResolvedQuestion;
    case "odd-one-out":
      const oddOneOutSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        items: [...publicQuestion.payload.items],
        correctAnswer: oddOneOutSolution.payload.correctAnswer,
      } as ResolvedQuestion;
    case "matching":
      const matchingSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        leftItems: publicQuestion.payload.leftItems.map((item) => ({
          ...item,
          correctMatchId: matchingSolution.payload.matches[item.id],
        })),
        rightItems: [...publicQuestion.payload.rightItems],
      } as ResolvedQuestion;
    case "connect-pairs":
      const connectPairsSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        pairs: [...publicQuestion.payload.pairs],
        solutionPaths: Object.fromEntries(
          Object.entries(connectPairsSolution.payload.paths).map(([id, path]) => [id, [...path]]),
        ),
        requireFullCoverage: publicQuestion.payload.requireFullCoverage,
      } as ResolvedQuestion;
    case "true-false":
      const trueFalseSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        correctAnswer: trueFalseSolution.payload.correctAnswer,
      } as ResolvedQuestion;
    case "short-text":
      const shortTextSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        correctAnswer: shortTextSolution.payload.correctAnswer,
        acceptedAnswers: [...shortTextSolution.payload.acceptedAnswers],
      } as ResolvedQuestion;
    case "progressive-clues":
      const progressiveCluesSolution = solutionFor(solution, publicQuestion.type);
      const cluesByIndex = new Map(
        (reveals ?? [])
          .filter((reveal) => reveal.type === "progressive-clues")
          .map((reveal) => [reveal.payload.clueIndex, reveal.payload.clue] as const),
      );
      return {
        ...base,
        type: publicQuestion.type,
        clues: Array.from(
          { length: publicQuestion.payload.clueCount },
          (_, index) => cluesByIndex.get(index) ?? `clue-${index + 1}`,
        ),
        cluePenalty: publicQuestion.payload.cluePenalty,
        correctAnswer: progressiveCluesSolution.payload.correctAnswer,
        acceptedAnswers: [...progressiveCluesSolution.payload.acceptedAnswers],
      } as ResolvedQuestion;
    case "progressive-image":
      const progressiveImageSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
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
      } as ResolvedQuestion;
    case "heat-map":
      const heatMapSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        surface: publicQuestion.payload.surface,
        targetLabel: publicQuestion.payload.targetLabel,
        target: heatMapSolution.payload.target,
        fullCreditRadius: heatMapSolution.payload.fullCreditRadius,
        toleranceRadius: heatMapSolution.payload.toleranceRadius,
      } as ResolvedQuestion;
    case "image-labeling": {
      const payload = publicQuestion.payload;
      const imageSolution = solutionFor(solution, publicQuestion.type).payload;
      if (payload.task === "assign-all" && imageSolution.task === "assign-all") {
        return {
          ...base,
          type: publicQuestion.type,
          task: "assign-all",
          surface: payload.surface,
          anchors: payload.anchors.map((anchor) => ({
            ...anchor,
            correctLabelId: imageSolution.labelsByAnchorId[anchor.id],
          })),
          labels: [...payload.labels],
        } as ResolvedQuestion;
      }
      if (payload.task === "identify-one" && imageSolution.task === "identify-one") {
        return {
          ...base,
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
        } as ResolvedQuestion;
      }
      throw new Error("Mismatched image-labeling public and solution contracts");
    }
    case "ordering":
      const orderingSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        items: [...publicQuestion.payload.items],
        correctOrder: [...orderingSolution.payload.correctOrder],
        ...(publicQuestion.payload.directionLabels
          ? { directionLabels: publicQuestion.payload.directionLabels }
          : {}),
      } as ResolvedQuestion;
    case "classification":
      const classificationSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        categories: [...publicQuestion.payload.categories],
        items: publicQuestion.payload.items.map((item) => ({
          ...item,
          correctCategory: classificationSolution.payload.categoriesByItem[item.label],
        })),
      } as ResolvedQuestion;
    case "flash-memory":
      const flashMemorySolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        revealDuration: publicQuestion.payload.revealDurationMs / 1_000,
        grid: publicQuestion.payload.grid,
        items: publicQuestion.payload.items.map((item) => ({
          ...item,
          correctPosition: flashMemorySolution.payload.positionsByItemId[item.id],
        })),
      } as ResolvedQuestion;
    case "memory-pairs": {
      const tileReveals = memoryPairReveals(reveals);
      const memoryPairsSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
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
      } as ResolvedQuestion;
    }
    case "simon-sequence":
      const simonSequenceSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        pads: [...publicQuestion.payload.pads],
        sequence: [...simonSequenceSolution.payload.sequence],
      } as ResolvedQuestion;
    case "logic-matrix":
      const logicMatrixSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        pieces: [...publicQuestion.payload.pieces],
        cells: [...publicQuestion.payload.cells],
        optionIds: [...publicQuestion.payload.optionIds],
        correctOptionId: logicMatrixSolution.payload.correctOptionId,
        ...(publicQuestion.payload.showPieceLabels === null
          ? {}
          : { showPieceLabels: publicQuestion.payload.showPieceLabels }),
      } as ResolvedQuestion;
    case "mini-sudoku":
      const miniSudokuSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        grid: [...publicQuestion.payload.grid],
        solution: [...miniSudokuSolution.payload.solution],
      } as ResolvedQuestion;
    case "mini-nonogram":
      const miniNonogramSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        rowClues: publicQuestion.payload.rowClues.map((row) => [...row]),
        columnClues: publicQuestion.payload.columnClues.map((column) => [...column]),
        solution: [...miniNonogramSolution.payload.solution],
      } as ResolvedQuestion;
    case "queens":
      const queensSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        regions: [...publicQuestion.payload.regions],
        ...(publicQuestion.payload.prefilledQueens.length > 0
          ? { prefilledQueens: [...publicQuestion.payload.prefilledQueens] }
          : {}),
        solution: [...queensSolution.payload.solution],
      } as ResolvedQuestion;
    case "time-maze":
      solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        cells: [...publicQuestion.payload.cells],
      } as ResolvedQuestion;
    case "zip":
      const zipSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
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
      } as ResolvedQuestion;
    case "pipes":
      const pipesSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        tiles: [...publicQuestion.payload.tiles],
        initialRotations: [...publicQuestion.payload.initialRotations],
        source: publicQuestion.payload.source,
        solutionRotations: [...pipesSolution.payload.solutionRotations],
      } as ResolvedQuestion;
    case "sliding-puzzle":
      const slidingPuzzleSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        initialTiles: [...publicQuestion.payload.initialTiles],
        solution: [...slidingPuzzleSolution.payload.solution],
      } as ResolvedQuestion;
    case "escape":
      const escapeSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
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
      } as ResolvedQuestion;
    case "error-reconstruction":
      const errorReconstructionSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
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
      } as ResolvedQuestion;
    case "anagram":
      const anagramSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        tiles: [...publicQuestion.payload.tiles],
        correctAnswer: anagramSolution.payload.correctAnswer,
        ...(publicQuestion.payload.hint === null ? {} : { hint: publicQuestion.payload.hint }),
      } as ResolvedQuestion;
    case "word-hashtag":
      const wordHashtagSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        initialLetters: [...publicQuestion.payload.initialLetters],
        maxMoves: publicQuestion.payload.maxMoves,
        words: wordHashtagSolution.payload.words,
      } as ResolvedQuestion;
    case "word-search":
      const wordSearchSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        letters: [...publicQuestion.payload.letters],
        targets: publicQuestion.payload.targets.map((target) => ({
          ...target,
          ...wordSearchSolution.payload.positionsByTargetId[target.id],
        })),
      } as ResolvedQuestion;
    case "mini-wordle":
      const miniWordleSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        correctAnswer: miniWordleSolution.payload.correctAnswer,
        additionalGuesses: [...miniWordleSolution.payload.additionalGuesses],
        dictionaryId: miniWordleSolution.payload.dictionaryId,
        ...(publicQuestion.payload.hint === null ? {} : { hint: publicQuestion.payload.hint }),
        wordLength: publicQuestion.payload.wordLength,
        maxAttempts: publicQuestion.payload.maxAttempts,
      } as ResolvedQuestion;
    case "logic-code":
      const logicCodeSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...base,
        type: publicQuestion.type,
        clues: [...publicQuestion.payload.clues],
        codeLength: publicQuestion.payload.codeLength,
        correctAnswer: logicCodeSolution.payload.correctAnswer,
      } as ResolvedQuestion;
    case "estimation":
      const estimationSolution = solutionFor(solution, publicQuestion.type);
      const { media, ...estimationPayload } = publicQuestion.payload;
      return {
        ...base,
        type: publicQuestion.type,
        ...estimationPayload,
        ...(media === null ? {} : { media }),
        correctAnswer: estimationSolution.payload.correctAnswer,
        tolerance: estimationSolution.payload.tolerance,
      } as ResolvedQuestion;
    default: {
      const exhaustive: never = publicQuestion;
      throw new Error(`Unsupported competitive question: ${String(exhaustive)}`);
    }
  }
}

export type { CanonicalQuestionResolutionInput as CompetitiveQuestionResolutionInput };
