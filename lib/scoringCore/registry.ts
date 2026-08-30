import type { QuestionType } from "@/types/game";
import { scoring as anagramScoring } from "@/lib/scoringCore/questions/anagram";
import { scoring as classificationScoring } from "@/lib/scoringCore/questions/classification";
import { scoring as connectPairsScoring } from "@/lib/scoringCore/questions/connectPairs";
import { scoring as errorReconstructionScoring } from "@/lib/scoringCore/questions/errorReconstruction";
import { scoring as estimationScoring } from "@/lib/scoringCore/questions/estimation";
import { scoring as escapeScoring } from "@/lib/scoringCore/questions/escape";
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
import { scoring as pipesScoring } from "@/lib/scoringCore/questions/pipes";
import { scoring as orderingScoring } from "@/lib/scoringCore/questions/ordering";
import { scoring as progressiveCluesScoring } from "@/lib/scoringCore/questions/progressiveClues";
import { scoring as progressiveImageScoring } from "@/lib/scoringCore/questions/progressiveImage";
import { scoring as queensScoring } from "@/lib/scoringCore/questions/queens";
import { scoring as shortTextScoring } from "@/lib/scoringCore/questions/shortText";
import { scoring as simonSequenceScoring } from "@/lib/scoringCore/questions/simonSequence";
import { scoring as slidingPuzzleScoring } from "@/lib/scoringCore/questions/slidingPuzzle";
import { scoring as timeMazeScoring } from "@/lib/scoringCore/questions/timeMaze";
import { scoring as trueFalseScoring } from "@/lib/scoringCore/questions/trueFalse";
import { scoring as wordHashtagScoring } from "@/lib/scoringCore/questions/wordHashtag";
import { scoring as wordSearchScoring } from "@/lib/scoringCore/questions/wordSearch";
import { scoring as zipScoring } from "@/lib/scoringCore/questions/zip";
import type { QuestionScoring, ScoringPolicyId } from "@/lib/scoringCore/types";

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
  queens: queensScoring,
  "time-maze": timeMazeScoring,
  "sliding-puzzle": slidingPuzzleScoring,
  "error-reconstruction": errorReconstructionScoring,
  anagram: anagramScoring,
  "word-hashtag": wordHashtagScoring,
  "word-search": wordSearchScoring,
  "mini-wordle": miniWordleScoring,
  "logic-code": logicCodeScoring,
  estimation: estimationScoring,
  escape: escapeScoring,
  zip: zipScoring,
  pipes: pipesScoring,
};

export const QUESTION_SCORING_POLICY = Object.fromEntries(
  Object.entries(SCORING).map(([type, scoring]) => [type, scoring.policy]),
) as Record<QuestionType, ScoringPolicyId>;
