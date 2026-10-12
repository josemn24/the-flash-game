import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { AnswerValue } from "@/types/contracts";
import type { ReviewProps } from "../../rendererTypes";
import { AnswerPair } from "../../reviewShared";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"odd-one-out">>) {
  const labelFor = (id: AnswerValue | null) =>
    typeof id === "string"
      ? (question.items.find((item) => item.id === id)?.label ?? "Respuesta no válida")
      : null;

  return (
    <AnswerPair
      answer={labelFor(result.answer)}
      correct={labelFor(question.correctAnswer) ?? question.correctAnswer}
    />
  );
}
