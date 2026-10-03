import type { ComponentType } from "react";
import type { PracticeQuestionOfType, PracticeQuestionType } from "@/types/gameplay/practice";
import type { ReviewProps } from "./rendererTypes";
import { ReviewContent as ChoiceReview } from "./formats/multiple-choice/ReviewContent";
import { ReviewContent as OddOneOutReview } from "./formats/odd-one-out/ReviewContent";
import { ReviewContent as MatchingReview } from "./formats/matching/ReviewContent";
import { ReviewContent as ConnectPairsReview } from "./formats/connect-pairs/ReviewContent";
import { ReviewContent as TrueFalseReview } from "./formats/true-false/ReviewContent";
import { ReviewContent as ShortTextReview } from "./formats/short-text/ReviewContent";
import { ReviewContent as ProgressiveCluesReview } from "./formats/progressive-clues/ReviewContent";
import { ReviewContent as ProgressiveImageReview } from "./formats/progressive-image/ReviewContent";
import { ReviewContent as HeatMapReview } from "./formats/heat-map/ReviewContent";
import { ReviewContent as ImageLabelingReview } from "./formats/image-labeling/ReviewContent";
import { ReviewContent as OrderingReview } from "./formats/ordering/ReviewContent";
import { ReviewContent as ClassificationReview } from "./formats/classification/ReviewContent";
import { ReviewContent as FlashMemoryReview } from "./formats/flash-memory/ReviewContent";
import { ReviewContent as MemoryPairsReview } from "./formats/memory-pairs/ReviewContent";
import { ReviewContent as SimonSequenceReview } from "./formats/simon-sequence/ReviewContent";
import { ReviewContent as LogicMatrixReview } from "./formats/logic-matrix/ReviewContent";
import { ReviewContent as MiniSudokuReview } from "./formats/mini-sudoku/ReviewContent";
import { ReviewContent as MiniNonogramReview } from "./formats/mini-nonogram/ReviewContent";
import { ReviewContent as QueensReview } from "./formats/queens/ReviewContent";
import { ReviewContent as TimeMazeReview } from "./formats/time-maze/ReviewContent";
import { ReviewContent as SlidingPuzzleReview } from "./formats/sliding-puzzle/ReviewContent";
import { ReviewContent as EscapeReview } from "./formats/escape/ReviewContent";
import { ReviewContent as ErrorReconstructionReview } from "./formats/error-reconstruction/ReviewContent";
import { ReviewContent as AnagramReview } from "./formats/anagram/ReviewContent";
import { ReviewContent as WordHashtagReview } from "./formats/word-hashtag/ReviewContent";
import { ReviewContent as WordSearchReview } from "./formats/word-search/ReviewContent";
import { ReviewContent as MiniWordleReview } from "./formats/mini-wordle/ReviewContent";
import { ReviewContent as LogicCodeReview } from "./formats/logic-code/ReviewContent";
import { ReviewContent as EstimationReview } from "./formats/estimation/ReviewContent";
import { ReviewContent as ZipReview } from "./formats/zip/ReviewContent";
import { ReviewContent as PipesReview } from "./formats/pipes/ReviewContent";

export const QUESTION_REVIEW_RENDERERS = {
  "multiple-choice": ChoiceReview,
  "odd-one-out": OddOneOutReview,
  matching: MatchingReview,
  "connect-pairs": ConnectPairsReview,
  "true-false": TrueFalseReview,
  "short-text": ShortTextReview,
  "progressive-clues": ProgressiveCluesReview,
  "progressive-image": ProgressiveImageReview,
  "heat-map": HeatMapReview,
  "image-labeling": ImageLabelingReview,
  ordering: OrderingReview,
  classification: ClassificationReview,
  "flash-memory": FlashMemoryReview,
  "memory-pairs": MemoryPairsReview,
  "simon-sequence": SimonSequenceReview,
  "logic-matrix": LogicMatrixReview,
  "mini-sudoku": MiniSudokuReview,
  "mini-nonogram": MiniNonogramReview,
  queens: QueensReview,
  "time-maze": TimeMazeReview,
  "sliding-puzzle": SlidingPuzzleReview,
  escape: EscapeReview,
  "error-reconstruction": ErrorReconstructionReview,
  anagram: AnagramReview,
  "word-hashtag": WordHashtagReview,
  "word-search": WordSearchReview,
  "mini-wordle": MiniWordleReview,
  "logic-code": LogicCodeReview,
  estimation: EstimationReview,
  zip: ZipReview,
  pipes: PipesReview,
} satisfies { [T in PracticeQuestionType]: ComponentType<ReviewProps<PracticeQuestionOfType<T>>> };
