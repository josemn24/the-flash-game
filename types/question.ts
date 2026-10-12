/**
 * @deprecated Compatibility facade.
 *
 * Practice models live in `@/types/gameplay/practice` and competitive
 * question contracts live in `@/types/contracts`.
 */
import type {
  PracticeAnswerValueOfType,
  QuestionType as PracticeQuestionType,
} from "@/types/gameplay/practice";

export type * from "@/types/gameplay/practice";

export type {
  PracticeQuestion as LegacyQuestion,
  PracticeQuestion as Question,
  QuestionOfType,
  PracticeAnswerValueMap as LegacyAnswerValueMap,
  PracticeAnswerValueOfType as LegacyAnswerValueOfType,
} from "@/types/gameplay/practice";

export type QuestionType = PracticeQuestionType;
export type AnswerValue = PracticeAnswerValueOfType<QuestionType>;
