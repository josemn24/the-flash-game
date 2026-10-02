import type { ResolvedQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import {
  baseQuestion,
  memoryPairReveals,
  solutionFor,
  type CanonicalQuestionResolutionInput,
} from "./shared";
export function resolvePracticeQuestion({
  publicQuestion,
  solution,
  points,
  reveals,
}: CanonicalQuestionResolutionInput): ResolvedQuestion {
  switch (publicQuestion.type) {
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
    case "time-maze":
      const timeMazeSolution = solutionFor(solution, publicQuestion.type);
      return {
        ...baseQuestion(publicQuestion, timeMazeSolution, points),
        type: publicQuestion.type,
        grid: publicQuestion.payload.grid,
        cells: [...publicQuestion.payload.cells],
      } satisfies ResolvedQuestionOfType<"time-maze">;
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
    default: {
      throw new Error("Unsupported practice format");
    }
  }
  throw new Error("Unsupported practice format");
}
