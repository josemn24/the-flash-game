import {
  AssignAllImageLabelingReviewSurface,
  IdentifyOneImageLabelingReviewSurface,
} from "@/components/questions";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isImageLabelingAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";
import { AnswerPair } from "../../reviewShared";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"image-labeling">>) {
  if (question.task === "identify-one") {
    const answer = typeof result.answer === "string" ? result.answer : null;
    return (
      <div className="grid gap-3">
        <IdentifyOneImageLabelingReviewSurface
          question={question}
          answer={answer}
          isCorrect={result.isCorrect}
        />
        <AnswerPair answer={answer} correct={question.response.correctAnswer} />
      </div>
    );
  }

  const answer = isImageLabelingAnswer(result.answer) ? result.answer : null;
  const details =
    result.details?.type === "image-labeling" && result.details.task === "assign-all"
      ? result.details
      : undefined;

  return (
    <div className="grid gap-3">
      <AssignAllImageLabelingReviewSurface question={question} answer={answer} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Etiquetas correctas</span>
          <strong>
            {details ? `${details.correctLabels} de ${details.totalLabels}` : "Sin respuesta"}
          </strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Resultado</span>
          <strong>
            {details ? `${Math.round((details.correctLabels / details.totalLabels) * 100)} %` : "—"}
          </strong>
        </div>
      </div>
    </div>
  );
}
