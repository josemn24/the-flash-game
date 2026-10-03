import { CheckIcon, CrossIcon } from "@/components/ui";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isMatchingAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"matching">>) {
  const answer = isMatchingAnswer(result.answer) ? result.answer : null;
  return (
    <div className={styles.classificationReviewList}>
      {question.leftItems.map((item) => {
        const chosenId = answer?.[item.id];
        const chosenLabel = question.rightItems.find((right) => right.id === chosenId)?.label;
        const correctLabel = question.rightItems.find(
          (right) => right.id === item.correctMatchId,
        )?.label;
        const correct = chosenId === item.correctMatchId;
        return (
          <div key={item.id} className={styles.classificationReviewRow}>
            <strong>{item.label}</strong>
            <span>
              <small>Emparejada</small>
              <span className={styles.classificationValue}>
                {correct ? <CheckIcon aria-hidden="true" /> : <CrossIcon aria-hidden="true" />}
                <b
                  className={
                    correct ? styles.classificationValueCorrect : styles.classificationValueWrong
                  }
                >
                  {chosenLabel ?? "Sin emparejar"}
                </b>
              </span>
            </span>
            <span>
              <small>Correcta</small>
              <span className={styles.classificationValue}>
                <CheckIcon aria-hidden="true" />
                <b className={styles.classificationValueCorrect}>{correctLabel}</b>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
