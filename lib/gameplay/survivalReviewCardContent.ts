import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import type { PracticeQuestion } from "@/types/gameplay/practice";

export function getSurvivalReviewCardContent(question: PracticeQuestion) {
  const format = QUESTION_FORMAT_LABELS[question.type];
  return {
    title: question.question,
    subtitle: question.category ? `${format} · ${question.category}` : format,
  };
}
