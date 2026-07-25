import type { QuestionType } from "@/types/game";
import { scoring as anagramScoring } from "@/lib/scoringCore/questions/anagram";
import { scoring as classificationScoring } from "@/lib/scoringCore/questions/classification";
import { scoring as connectPairsScoring } from "@/lib/scoringCore/questions/connectPairs";
import { scoring as errorReconstructionScoring } from "@/lib/scoringCore/questions/errorReconstruction";
import { scoring as estimationScoring } from "@/lib/scoringCore/questions/estimation";
import { scoring as flashMemoryScoring } from "@/lib/scoringCore/questions/flashMemory";
import { scoring as heatMapScoring } from "@/lib/scoringCore/questions/heatMap";
import { scoring as imageLabelingScoring } from "@/lib/scoringCore/questions/imageLabeling";
import { scoring as logicCodeScoring } from "@/lib/scoringCore/questions/logicCode";
import { scoring as logicMatrixScoring } from "@/lib/scoringCore/questions/logicMatrix";
import { scoring as matchingScoring } from "@/lib/scoringCore/questions/matching";
import { scoring as memoryPairsScoring } from "@/lib/scoringCore/questions/memoryPairs";
import { scoring as miniNonogramScoring } from "@/lib/scoringCore/questions/miniNonogram";
import { scoring as miniSudokuScoring } from "@/lib/scoringCore/questions/miniSudoku";
import { scoring as miniWordleScoring } from "@/lib/scoringCore/questions/miniWordle";
import { scoring as multipleChoiceScoring } from "@/lib/scoringCore/questions/multipleChoice";
import { scoring as oddOneOutScoring } from "@/lib/scoringCore/questions/oddOneOut";
import { scoring as orderingScoring } from "@/lib/scoringCore/questions/ordering";
import { scoring as progressiveCluesScoring } from "@/lib/scoringCore/questions/progressiveClues";
import { scoring as progressiveImageScoring } from "@/lib/scoringCore/questions/progressiveImage";
import { scoring as shortTextScoring } from "@/lib/scoringCore/questions/shortText";
import { scoring as simonSequenceScoring } from "@/lib/scoringCore/questions/simonSequence";
import { scoring as slidingPuzzleScoring } from "@/lib/scoringCore/questions/slidingPuzzle";
import { scoring as timeMazeScoring } from "@/lib/scoringCore/questions/timeMaze";
import { scoring as trueFalseScoring } from "@/lib/scoringCore/questions/trueFalse";
import type { QuestionScoring, ScoringPolicyId } from "@/lib/scoringCore/types";

export const QUESTION_SCORING_POLICY = {
  "multiple-choice": "binary-speed",
  "odd-one-out": "binary-speed",
  matching: "partial-items",
  "connect-pairs": "partial-items",
  "true-false": "binary-speed",
  "short-text": "binary-speed",
  "progressive-clues": "clue-speed",
  "progressive-image": "binary-speed",
  "heat-map": "spatial-proximity",
  "image-labeling": "image-labeling",
  ordering: "partial-items",
  classification: "partial-items",
  "flash-memory": "partial-items",
  "memory-pairs": "partial-items",
  "simon-sequence": "binary-speed",
  "logic-matrix": "binary-speed",
  "mini-sudoku": "partial-items",
  "mini-nonogram": "partial-items",
  "time-maze": "binary-speed",
  "sliding-puzzle": "binary-speed",
  "error-reconstruction": "error-location-correction",
  anagram: "binary-speed",
  "mini-wordle": "attempt-penalty",
  "logic-code": "attempt-penalty",
  estimation: "proximity",
} as const satisfies Record<QuestionType, ScoringPolicyId>;

export const SCORING: Record<QuestionType, QuestionScoring> = {
  "multiple-choice": multipleChoiceScoring,
  "odd-one-out": oddOneOutScoring,
  matching: matchingScoring,
  "connect-pairs": connectPairsScoring,
  "true-false": trueFalseScoring,
  "short-text": shortTextScoring,
  "progressive-clues": progressiveCluesScoring,
  "progressive-image": progressiveImageScoring,
  "heat-map": heatMapScoring,
  "image-labeling": imageLabelingScoring,
  ordering: orderingScoring,
  classification: classificationScoring,
  "flash-memory": flashMemoryScoring,
  "memory-pairs": memoryPairsScoring,
  "simon-sequence": simonSequenceScoring,
  "logic-matrix": logicMatrixScoring,
  "mini-sudoku": miniSudokuScoring,
  "mini-nonogram": miniNonogramScoring,
  "time-maze": timeMazeScoring,
  "sliding-puzzle": slidingPuzzleScoring,
  "error-reconstruction": errorReconstructionScoring,
  anagram: anagramScoring,
  "mini-wordle": miniWordleScoring,
  "logic-code": logicCodeScoring,
  estimation: estimationScoring,
};
