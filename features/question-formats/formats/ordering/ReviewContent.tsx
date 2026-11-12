import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";
import { AnswerPair } from "../../reviewShared";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"ordering">>) {
  const snapshot =
    result.reviewState?.type === "ordering" ? result.reviewState.answer : result.answer;
  const details = result.details?.type === "ordering" ? result.details : undefined;
  return (
    <>
      {details ? (
        <p>
          {details.correctItems} de {details.totalItems} elementos en su posición correcta.
        </p>
      ) : null}
      <AnswerPair answer={snapshot} correct={question.correctOrder} />
    </>
  );
}
