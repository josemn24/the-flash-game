import { validateStoredPublic as anagramValidator } from "./anagram/validation";
import { validateStoredPublic as classificationValidator } from "./classification/validation";
import { validateStoredPublic as connectPairsValidator } from "./connect-pairs/validation";
import type { CompetitiveQuestionType } from "./definitions";
import { validateStoredPublic as escapeValidator } from "./escape/validation";
import { validateStoredPublic as estimationValidator } from "./estimation/validation";
import { validateStoredPublic as heatMapValidator } from "./heat-map/validation";
import { validateStoredPublic as logicCodeValidator } from "./logic-code/validation";
import { validateStoredPublic as logicMatrixValidator } from "./logic-matrix/validation";
import { validateStoredPublic as matchingValidator } from "./matching/validation";
import { validateStoredPublic as miniWordleValidator } from "./mini-wordle/validation";
import { validateStoredPublic as multipleChoiceValidator } from "./multiple-choice/validation";
import { validateStoredPublic as oddOneOutValidator } from "./odd-one-out/validation";
import { validateStoredPublic as orderingValidator } from "./ordering/validation";
import { validateStoredPublic as progressiveCluesValidator } from "./progressive-clues/validation";
import { validateStoredPublic as progressiveImageValidator } from "./progressive-image/validation";
import { validateStoredPublic as queensValidator } from "./queens/validation";
import { validateStoredPublic as shortTextValidator } from "./short-text/validation";
import type { StoredPublicContext } from "./stored-common";
import { validateStoredPublic as trueFalseValidator } from "./true-false/validation";
import type { ValidationResult } from "./types";
import { validateStoredPublic as wordHashtagValidator } from "./word-hashtag/validation";
import { validateStoredPublic as wordSearchValidator } from "./word-search/validation";
import { validateStoredPublic as zipValidator } from "./zip/validation";
export const STORED_PUBLIC_VALIDATORS = {
  anagram: anagramValidator,
  classification: classificationValidator,
  "connect-pairs": connectPairsValidator,
  escape: escapeValidator,
  estimation: estimationValidator,
  "heat-map": heatMapValidator,
  "logic-code": logicCodeValidator,
  "logic-matrix": logicMatrixValidator,
  matching: matchingValidator,
  "mini-wordle": miniWordleValidator,
  "multiple-choice": multipleChoiceValidator,
  "odd-one-out": oddOneOutValidator,
  ordering: orderingValidator,
  "progressive-clues": progressiveCluesValidator,
  "progressive-image": progressiveImageValidator,
  queens: queensValidator,
  "short-text": shortTextValidator,
  "true-false": trueFalseValidator,
  "word-hashtag": wordHashtagValidator,
  "word-search": wordSearchValidator,
  zip: zipValidator,
} satisfies Record<
  CompetitiveQuestionType,
  (value: unknown, context: StoredPublicContext) => ValidationResult<unknown>
>;
