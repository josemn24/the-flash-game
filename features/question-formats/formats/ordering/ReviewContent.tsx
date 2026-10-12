import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";
import { AnswerPair } from "../../reviewShared";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"ordering">>) {
  return <AnswerPair answer={result.answer} correct={question.correctOrder} />;
}
