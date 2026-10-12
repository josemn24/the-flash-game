import { QuestionMedia } from "@/components/questions";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { calculateProgressiveImageReveal } from "@/lib/progressiveImage";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";
import { AnswerPair } from "../../reviewShared";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"progressive-image">>) {
  const revealedPercentage = Math.round(
    calculateProgressiveImageReveal(result.timeUsed, question.revealDuration) * 100,
  );

  return (
    <div className="grid gap-3">
      <QuestionMedia
        compact
        media={{
          type: "image",
          src: question.surface.src,
          alt: question.solutionAlt,
          fit: question.surface.fit,
          position: question.surface.position,
        }}
      />
      <AnswerPair answer={result.answer} correct={question.correctAnswer} />
      <div className={styles.answerBox}>
        <span>Imagen revelada al responder</span>
        <strong>{result.answer === null ? "Sin respuesta" : `${revealedPercentage} %`}</strong>
      </div>
    </div>
  );
}
