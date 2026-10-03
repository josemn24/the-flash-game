import type { ComponentType } from "react";
import type { PracticeQuestionOfType, PracticeQuestionType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "./rendererTypes";
import { PracticeInput as MultipleChoiceInput } from "./formats/multiple-choice/PracticeInput";
import { PracticeInput as OddOneOutInput } from "./formats/odd-one-out/PracticeInput";
import { PracticeInput as MatchingInput } from "./formats/matching/PracticeInput";
import { PracticeInput as ConnectPairsInput } from "./formats/connect-pairs/PracticeInput";
import { PracticeInput as TrueFalseInput } from "./formats/true-false/PracticeInput";
import { PracticeInput as ShortTextInput } from "./formats/short-text/PracticeInput";
import { PracticeInput as ProgressiveCluesInput } from "./formats/progressive-clues/PracticeInput";
import { PracticeInput as ProgressiveImageInput } from "./formats/progressive-image/PracticeInput";
import { PracticeInput as HeatMapInput } from "./formats/heat-map/PracticeInput";
import { PracticeInput as ImageLabelingInput } from "./formats/image-labeling/PracticeInput";
import { PracticeInput as OrderingInput } from "./formats/ordering/PracticeInput";
import { PracticeInput as ClassificationInput } from "./formats/classification/PracticeInput";
import { PracticeInput as FlashMemoryInput } from "./formats/flash-memory/PracticeInput";
import { PracticeInput as MemoryPairsInput } from "./formats/memory-pairs/PracticeInput";
import { PracticeInput as SimonSequenceInput } from "./formats/simon-sequence/PracticeInput";
import { PracticeInput as LogicMatrixInput } from "./formats/logic-matrix/PracticeInput";
import { PracticeInput as MiniSudokuInput } from "./formats/mini-sudoku/PracticeInput";
import { PracticeInput as MiniNonogramInput } from "./formats/mini-nonogram/PracticeInput";
import { PracticeInput as QueensInput } from "./formats/queens/PracticeInput";
import { PracticeInput as TimeMazeInput } from "./formats/time-maze/PracticeInput";
import { PracticeInput as SlidingPuzzleInput } from "./formats/sliding-puzzle/PracticeInput";
import { PracticeInput as EscapeInput } from "./formats/escape/PracticeInput";
import { PracticeInput as ErrorReconstructionInput } from "./formats/error-reconstruction/PracticeInput";
import { PracticeInput as AnagramInput } from "./formats/anagram/PracticeInput";
import { PracticeInput as WordHashtagInput } from "./formats/word-hashtag/PracticeInput";
import { PracticeInput as WordSearchInput } from "./formats/word-search/PracticeInput";
import { PracticeInput as MiniWordleInput } from "./formats/mini-wordle/PracticeInput";
import { PracticeInput as LogicCodeInput } from "./formats/logic-code/PracticeInput";
import { PracticeInput as EstimationInput } from "./formats/estimation/PracticeInput";
import { PracticeInput as ZipInput } from "./formats/zip/PracticeInput";
import { PracticeInput as PipesInput } from "./formats/pipes/PracticeInput";

export const QUESTION_INPUT_RENDERERS = {
  "multiple-choice": MultipleChoiceInput,
  "odd-one-out": OddOneOutInput,
  matching: MatchingInput,
  "connect-pairs": ConnectPairsInput,
  "true-false": TrueFalseInput,
  "short-text": ShortTextInput,
  "progressive-clues": ProgressiveCluesInput,
  "progressive-image": ProgressiveImageInput,
  "heat-map": HeatMapInput,
  "image-labeling": ImageLabelingInput,
  ordering: OrderingInput,
  classification: ClassificationInput,
  "flash-memory": FlashMemoryInput,
  "memory-pairs": MemoryPairsInput,
  "simon-sequence": SimonSequenceInput,
  "logic-matrix": LogicMatrixInput,
  "mini-sudoku": MiniSudokuInput,
  "mini-nonogram": MiniNonogramInput,
  queens: QueensInput,
  "time-maze": TimeMazeInput,
  "sliding-puzzle": SlidingPuzzleInput,
  escape: EscapeInput,
  "error-reconstruction": ErrorReconstructionInput,
  anagram: AnagramInput,
  "word-hashtag": WordHashtagInput,
  "word-search": WordSearchInput,
  "mini-wordle": MiniWordleInput,
  "logic-code": LogicCodeInput,
  estimation: EstimationInput,
  zip: ZipInput,
  pipes: PipesInput,
} satisfies {
  [T in PracticeQuestionType]: ComponentType<QuestionInputProps<PracticeQuestionOfType<T>>>;
};
