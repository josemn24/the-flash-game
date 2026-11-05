import type { PracticeQuestion } from "@/types/gameplay/practice";
import type { AnswerResult } from "@/types/gameplay/result";

export type ReviewProps<T extends PracticeQuestion = PracticeQuestion> = {
  question: T;
  result: AnswerResult;
};
