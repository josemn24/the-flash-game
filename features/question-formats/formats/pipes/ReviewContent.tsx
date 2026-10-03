import { PipesBoard } from "@/components/questions";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isPipesAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({ question, result }: ReviewProps<PracticeQuestionOfType<"pipes">>) {
  const answer = isPipesAnswer(result.answer)
    ? result.answer
    : { rotations: question.initialRotations, moves: 0 };
  const details = result.details?.type === "pipes" ? result.details : undefined;
  return (
    <div className="grid gap-3">
      <div className={styles.queensReviewPair}>
        <div>
          <span className={styles.memoryGridLabel}>Tu tablero</span>
          <PipesBoard question={question} answer={answer} label="Tablero final del jugador" />
        </div>
        <div>
          <span className={styles.memoryGridLabel}>Solución</span>
          <PipesBoard
            question={question}
            answer={{ rotations: question.solutionRotations, moves: 0 }}
            label="Solución de Tuberías"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className={styles.answerBox}>
          <span>Conectadas</span>
          <strong>
            {details?.connectedTiles ?? 0}/{details?.totalTiles ?? 25}
          </strong>
        </div>
        <div className={styles.answerBox}>
          <span>Salidas abiertas</span>
          <strong>{details?.openConnections ?? 0}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Redes aisladas</span>
          <strong>{details?.isolatedComponents ?? 0}</strong>
        </div>
        <div className={`${styles.answerBox} ${details?.solved ? styles.answerBoxCorrect : ""}`}>
          <span>Giros</span>
          <strong>{details?.moves ?? answer.moves}</strong>
        </div>
      </div>
    </div>
  );
}
