import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { readPublic as anagramReader, validatePublic as anagramValidator } from "./anagram/public";
import {
  readPublic as classificationReader,
  validatePublic as classificationValidator,
} from "./classification/public";
import {
  readPublic as connectPairsReader,
  validatePublic as connectPairsValidator,
} from "./connect-pairs/public";
import type { CompetitiveQuestionType } from "./definitions";
import { readPublic as escapeReader, validatePublic as escapeValidator } from "./escape/public";
import {
  readPublic as estimationReader,
  validatePublic as estimationValidator,
} from "./estimation/public";
import { readPublic as heatMapReader, validatePublic as heatMapValidator } from "./heat-map/public";
import {
  readPublic as logicCodeReader,
  validatePublic as logicCodeValidator,
} from "./logic-code/public";
import {
  readPublic as logicMatrixReader,
  validatePublic as logicMatrixValidator,
} from "./logic-matrix/public";
import {
  readPublic as matchingReader,
  validatePublic as matchingValidator,
} from "./matching/public";
import {
  readPublic as miniWordleReader,
  validatePublic as miniWordleValidator,
} from "./mini-wordle/public";
import {
  readPublic as multipleChoiceReader,
  validatePublic as multipleChoiceValidator,
} from "./multiple-choice/public";
import {
  readPublic as oddOneOutReader,
  validatePublic as oddOneOutValidator,
} from "./odd-one-out/public";
import {
  readPublic as orderingReader,
  validatePublic as orderingValidator,
} from "./ordering/public";
import {
  readPublic as progressiveCluesReader,
  validatePublic as progressiveCluesValidator,
} from "./progressive-clues/public";
import {
  readPublic as progressiveImageReader,
  validatePublic as progressiveImageValidator,
} from "./progressive-image/public";
import type { PublicReadContext } from "./public-common";
import { readPublic as queensReader, validatePublic as queensValidator } from "./queens/public";
import {
  readPublic as shortTextReader,
  validatePublic as shortTextValidator,
} from "./short-text/public";
import {
  readPublic as trueFalseReader,
  validatePublic as trueFalseValidator,
} from "./true-false/public";
import type { ValidationResult } from "./types";
import {
  readPublic as wordHashtagReader,
  validatePublic as wordHashtagValidator,
} from "./word-hashtag/public";
import {
  readPublic as wordSearchReader,
  validatePublic as wordSearchValidator,
} from "./word-search/public";
import { readPublic as zipReader, validatePublic as zipValidator } from "./zip/public";
export const PUBLIC_READERS = {
  "multiple-choice": multipleChoiceReader,
  "odd-one-out": oddOneOutReader,
  matching: matchingReader,
  "connect-pairs": connectPairsReader,
  "true-false": trueFalseReader,
  "short-text": shortTextReader,
  "progressive-clues": progressiveCluesReader,
  "progressive-image": progressiveImageReader,
  "heat-map": heatMapReader,
  ordering: orderingReader,
  classification: classificationReader,
  "logic-matrix": logicMatrixReader,
  queens: queensReader,
  zip: zipReader,
  escape: escapeReader,
  anagram: anagramReader,
  "word-hashtag": wordHashtagReader,
  "word-search": wordSearchReader,
  "mini-wordle": miniWordleReader,
  "logic-code": logicCodeReader,
  estimation: estimationReader,
} satisfies Record<CompetitiveQuestionType, (context: PublicReadContext) => ServerFlashQuestion>;
export const FORMAT_PUBLIC_VALIDATORS = {
  "multiple-choice": multipleChoiceValidator,
  "odd-one-out": oddOneOutValidator,
  matching: matchingValidator,
  "connect-pairs": connectPairsValidator,
  "true-false": trueFalseValidator,
  "short-text": shortTextValidator,
  "progressive-clues": progressiveCluesValidator,
  "progressive-image": progressiveImageValidator,
  "heat-map": heatMapValidator,
  ordering: orderingValidator,
  classification: classificationValidator,
  "logic-matrix": logicMatrixValidator,
  queens: queensValidator,
  zip: zipValidator,
  escape: escapeValidator,
  anagram: anagramValidator,
  "word-hashtag": wordHashtagValidator,
  "word-search": wordSearchValidator,
  "mini-wordle": miniWordleValidator,
  "logic-code": logicCodeValidator,
  estimation: estimationValidator,
} satisfies Record<
  CompetitiveQuestionType,
  (context: PublicReadContext) => ValidationResult<ServerFlashQuestion>
>;
