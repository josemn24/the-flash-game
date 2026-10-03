import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isClassificationAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

function categoryLabel(category: string | undefined) {
  if (!category) return "Sin respuesta";
  return category.charAt(0).toLocaleUpperCase("es") + category.slice(1);
}

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"classification">>) {
  const answer = isClassificationAnswer(result.answer) ? result.answer : null;
  return (
    <div className={styles.classificationReviewList}>
      {question.items.map((item) => {
        const chosenCategory = answer?.[item.label];
        const correct = chosenCategory === item.correctCategory;
        return (
          <div key={item.label} className={styles.classificationReviewRow}>
            <strong>{item.label}</strong>
            <span>
              <small>Elegida</small>
              <b
                className={
                  correct ? styles.classificationValueCorrect : styles.classificationValueWrong
                }
              >
                {categoryLabel(chosenCategory)}
              </b>
            </span>
            <span>
              <small>Correcta</small>
              <b className={styles.classificationValueCorrect}>
                {categoryLabel(item.correctCategory)}
              </b>
            </span>
          </div>
        );
      })}
    </div>
  );
}
