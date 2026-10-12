import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isSimonSequenceAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"simon-sequence">>) {
  const submittedSteps = isSimonSequenceAnswer(result.answer) ? result.answer : [];
  const details = result.details?.type === "simon-sequence" ? result.details : undefined;
  const labelFor = (step: string) => question.pads.find((pad) => pad.id === step)?.label ?? step;
  const mismatch = details?.firstMismatchIndex;
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Tu secuencia</span>
          <strong>
            {submittedSteps.length ? submittedSteps.map(labelFor).join(" → ") : "Sin respuesta"}
          </strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Secuencia correcta</span>
          <strong>{question.sequence.map(labelFor).join(" → ")}</strong>
        </div>
      </div>
      {mismatch !== null && mismatch !== undefined && submittedSteps.length > 0 && (
        <div className={styles.answerBox}>
          <span>Primer paso divergente</span>
          <strong>Paso {mismatch + 1}</strong>
        </div>
      )}
    </div>
  );
}
