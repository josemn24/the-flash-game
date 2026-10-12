import type { CSSProperties } from "react";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isMiniWordleAnswer } from "@/lib/scoring";
import {
  getMiniWordleFeedback,
  getMiniWordleMaxAttempts,
  getMiniWordleWordLength,
} from "@/lib/miniWordle";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"mini-wordle">>) {
  const answer = isMiniWordleAnswer(result.answer) ? result.answer : null;
  const details = result.details?.type === "mini-wordle" ? result.details : undefined;
  const wordLength = getMiniWordleWordLength(question);
  const maxAttempts = getMiniWordleMaxAttempts(question);
  return (
    <div className="grid gap-3">
      {answer?.guesses.length ? (
        <div
          className={styles.wordleReview}
          style={{ "--mini-wordle-columns": wordLength } as CSSProperties}
          aria-label="Intentos realizados"
        >
          {answer.guesses.map((guess, rowIndex) => (
            <div key={`${guess}-${rowIndex}`} className={styles.wordleReviewRow}>
              {getMiniWordleFeedback(guess, question.correctAnswer).map((item, index) => (
                <span
                  key={`${item.letter}-${index}`}
                  className={`${styles.wordleReviewTile} ${styles[`wordle-${item.status}`]}`}
                  aria-label={`${item.letter}: ${
                    item.status === "correct"
                      ? "posición correcta"
                      : item.status === "present"
                        ? "está en otra posición"
                        : "no está en la palabra"
                  }`}
                >
                  {item.letter}
                  <small aria-hidden="true">
                    {item.status === "correct" ? "✓" : item.status === "present" ? "↔" : "×"}
                  </small>
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.answerBox}>Sin intentos enviados</div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Intentos utilizados</span>
          <strong>
            {details?.attemptsUsed ?? 0} de {maxAttempts}
          </strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Solución</span>
          <strong>{question.correctAnswer}</strong>
        </div>
      </div>
    </div>
  );
}
