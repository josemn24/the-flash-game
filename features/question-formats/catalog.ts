import type { QuestionFormatCatalog } from "./catalogTypes";
import { guide as anagramGuide } from "./formats/anagram/guide";
import { guide as classificationGuide } from "./formats/classification/guide";
import { guide as connectPairsGuide } from "./formats/connect-pairs/guide";
import { guide as errorReconstructionGuide } from "./formats/error-reconstruction/guide";
import { guide as escapeGuide } from "./formats/escape/guide";
import { guide as estimationGuide } from "./formats/estimation/guide";
import { guide as flashMemoryGuide } from "./formats/flash-memory/guide";
import { guide as heatMapGuide } from "./formats/heat-map/guide";
import { guide as imageLabelingGuide } from "./formats/image-labeling/guide";
import { guide as logicCodeGuide } from "./formats/logic-code/guide";
import { guide as logicMatrixGuide } from "./formats/logic-matrix/guide";
import { guide as matchingGuide } from "./formats/matching/guide";
import { guide as memoryPairsGuide } from "./formats/memory-pairs/guide";
import { guide as miniNonogramGuide } from "./formats/mini-nonogram/guide";
import { guide as miniSudokuGuide } from "./formats/mini-sudoku/guide";
import { guide as miniWordleGuide } from "./formats/mini-wordle/guide";
import { guide as multipleChoiceGuide } from "./formats/multiple-choice/guide";
import { guide as oddOneOutGuide } from "./formats/odd-one-out/guide";
import { guide as orderingGuide } from "./formats/ordering/guide";
import { guide as pipesGuide } from "./formats/pipes/guide";
import { guide as progressiveCluesGuide } from "./formats/progressive-clues/guide";
import { guide as progressiveImageGuide } from "./formats/progressive-image/guide";
import { guide as queensGuide } from "./formats/queens/guide";
import { guide as shortTextGuide } from "./formats/short-text/guide";
import { guide as simonSequenceGuide } from "./formats/simon-sequence/guide";
import { guide as slidingPuzzleGuide } from "./formats/sliding-puzzle/guide";
import { guide as timeMazeGuide } from "./formats/time-maze/guide";
import { guide as trueFalseGuide } from "./formats/true-false/guide";
import { guide as wordHashtagGuide } from "./formats/word-hashtag/guide";
import { guide as wordSearchGuide } from "./formats/word-search/guide";
import { guide as zipGuide } from "./formats/zip/guide";
export type { QuestionFormatCatalog, QuestionFormatGuide } from "./catalogTypes";

export const QUESTION_FORMAT_CATALOG = {
  "multiple-choice": multipleChoiceGuide,
  "odd-one-out": oddOneOutGuide,
  matching: matchingGuide,
  "connect-pairs": connectPairsGuide,
  "true-false": trueFalseGuide,
  "short-text": shortTextGuide,
  ordering: orderingGuide,
  classification: classificationGuide,
  "logic-code": logicCodeGuide,
  estimation: estimationGuide,
  "progressive-clues": progressiveCluesGuide,
  "heat-map": heatMapGuide,
  "image-labeling": imageLabelingGuide,
  "flash-memory": flashMemoryGuide,
  "memory-pairs": memoryPairsGuide,
  "simon-sequence": simonSequenceGuide,
  "logic-matrix": logicMatrixGuide,
  "mini-sudoku": miniSudokuGuide,
  "mini-nonogram": miniNonogramGuide,
  queens: queensGuide,
  "sliding-puzzle": slidingPuzzleGuide,
  escape: escapeGuide,
  "error-reconstruction": errorReconstructionGuide,
  anagram: anagramGuide,
  "word-hashtag": wordHashtagGuide,
  "word-search": wordSearchGuide,
  "mini-wordle": miniWordleGuide,
  "progressive-image": progressiveImageGuide,
  "time-maze": timeMazeGuide,
  zip: zipGuide,
  pipes: pipesGuide,
} satisfies QuestionFormatCatalog;

export const questionFormats = Object.values(QUESTION_FORMAT_CATALOG);

export function getQuestionFormatBySlug(slug: string) {
  return questionFormats.find((format) => format.slug === slug);
}
