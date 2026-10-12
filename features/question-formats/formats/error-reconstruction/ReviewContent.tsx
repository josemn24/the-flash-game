import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isErrorReconstructionAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"error-reconstruction">>) {
  const answer = isErrorReconstructionAnswer(result.answer) ? result.answer : null;
  const details = result.details?.type === "error-reconstruction" ? result.details : undefined;
  const selectedStep = question.steps.find((step) => step.id === answer?.stepId);
  const correctStep = question.steps.find((step) => step.id === question.firstErrorStepId)!;

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Tu primer error</span>
          <strong>{selectedStep?.text ?? "Sin respuesta"}</strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Primer error real</span>
          <strong>{correctStep.text}</strong>
        </div>
      </div>
      {question.correction && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={styles.answerBox}>
            <span>Tu corrección</span>
            <strong>{answer?.correction ?? "Sin corrección"}</strong>
          </div>
          <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
            <span>Corrección esperada</span>
            <strong>{question.correction.correctAnswer}</strong>
          </div>
        </div>
      )}
      <div className={styles.answerBox}>
        <span>Resultado de la localización</span>
        <strong>
          {details?.locationCorrect ? "Primer error localizado" : "Primer error no localizado"}
        </strong>
      </div>
    </div>
  );
}
