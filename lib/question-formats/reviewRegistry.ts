import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestion, PracticeQuestionOfType } from "@/types/gameplay/practice";
import { questionWithSolution as anagramReview } from "./anagram/review";
import { questionWithSolution as classificationReview } from "./classification/review";
import { questionWithSolution as connectPairsReview } from "./connect-pairs/review";
import { questionWithSolution as escapeReview } from "./escape/review";
import { questionWithSolution as estimationReview } from "./estimation/review";
import { questionWithSolution as heatMapReview } from "./heat-map/review";
import { questionWithSolution as logicCodeReview } from "./logic-code/review";
import { questionWithSolution as logicMatrixReview } from "./logic-matrix/review";
import { questionWithSolution as matchingReview } from "./matching/review";
import { questionWithSolution as miniWordleReview } from "./mini-wordle/review";
import { questionWithSolution as multipleChoiceReview } from "./multiple-choice/review";
import { questionWithSolution as oddOneOutReview } from "./odd-one-out/review";
import { questionWithSolution as orderingReview } from "./ordering/review";
import { questionWithSolution as progressiveCluesReview } from "./progressive-clues/review";
import { questionWithSolution as progressiveImageReview } from "./progressive-image/review";
import { questionWithSolution as queensReview } from "./queens/review";
import { questionWithSolution as shortTextReview } from "./short-text/review";
import { questionWithSolution as trueFalseReview } from "./true-false/review";
import { questionWithSolution as wordHashtagReview } from "./word-hashtag/review";
import { questionWithSolution as wordSearchReview } from "./word-search/review";
import { questionWithSolution as zipReview } from "./zip/review";
export const COMPETITIVE_REVIEW_ADAPTERS = {
  "multiple-choice": multipleChoiceReview,
  "odd-one-out": oddOneOutReview,
  matching: matchingReview,
  "connect-pairs": connectPairsReview,
  "true-false": trueFalseReview,
  "short-text": shortTextReview,
  "progressive-clues": progressiveCluesReview,
  "progressive-image": progressiveImageReview,
  "heat-map": heatMapReview,
  ordering: orderingReview,
  classification: classificationReview,
  "logic-matrix": logicMatrixReview,
  queens: queensReview,
  zip: zipReview,
  escape: escapeReview,
  anagram: anagramReview,
  "word-hashtag": wordHashtagReview,
  "word-search": wordSearchReview,
  "mini-wordle": miniWordleReview,
  "logic-code": logicCodeReview,
  estimation: estimationReview,
} satisfies {
  [T in CompetitiveQuestionType]: (
    question: Extract<ServerFlashQuestion, { type: T }>,
    row?: ServerFlashTerminalReview,
  ) => PracticeQuestionOfType<T>;
};
export function reviewQuestion(
  question: ServerFlashQuestion,
  row?: ServerFlashTerminalReview,
): PracticeQuestion {
  const reader = COMPETITIVE_REVIEW_ADAPTERS[question.type as CompetitiveQuestionType] as (
    question: ServerFlashQuestion,
    row?: ServerFlashTerminalReview,
  ) => PracticeQuestion;
  return reader(question, row);
}
