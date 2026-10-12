import { EscapeBoard } from "@/components/questions";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isEscapeAnswer } from "@/lib/scoring";
import { replayEscapeMoves } from "@/lib/escape";
import type { EscapeAnswer } from "@/types/gameplay";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({ question, result }: ReviewProps<PracticeQuestionOfType<"escape">>) {
  const answer: EscapeAnswer = isEscapeAnswer(result.answer) ? result.answer : { moves: [] };
  const replay = replayEscapeMoves(question, answer.moves);
  const reference = replayEscapeMoves(question, question.referenceSolution);
  const details = result.details?.type === "escape" ? result.details : undefined;

  return (
    <div className="grid gap-3">
      <div className={styles.escapeReviewPair}>
        <div>
          <span className={styles.memoryGridLabel}>Inicio</span>
          <EscapeBoard
            question={question}
            blocks={question.initialBlocks}
            label="Tablero inicial de Escape"
          />
        </div>
        <div>
          <span className={styles.memoryGridLabel}>Tu tablero</span>
          <EscapeBoard
            question={question}
            blocks={replay.blocks}
            label="Tablero final del jugador"
            animateEscape={details?.escaped}
          />
        </div>
        <div>
          <span className={styles.memoryGridLabel}>Una solución</span>
          <EscapeBoard
            question={question}
            blocks={reference.blocks}
            label="Solución de referencia"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={styles.answerBox}>
          <span>Movimientos</span>
          <strong>{details?.moves ?? replay.appliedMoves}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Óptimo editorial</span>
          <strong>{details?.optimalMoves ?? question.optimalMoves}</strong>
        </div>
        <div className={`${styles.answerBox} ${details?.escaped ? styles.answerBoxCorrect : ""}`}>
          <span>Resultado</span>
          <strong>{details?.escaped ? "Bloque liberado" : "Salida no alcanzada"}</strong>
        </div>
      </div>
    </div>
  );
}
