import { TimeMazeBoard } from "@/components/questions";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isTimeMazeAnswer } from "@/lib/scoring";
import { findShortestTimeMazePath, getTimeMazeStartIndex } from "@/lib/timeMaze";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"time-maze">>) {
  const answer = isTimeMazeAnswer(result.answer) ? result.answer : null;
  const details = result.details?.type === "time-maze" ? result.details : undefined;
  const path = answer?.path ?? [getTimeMazeStartIndex(question)];
  const optimalPath = findShortestTimeMazePath(question) ?? undefined;

  return (
    <div className="grid gap-3">
      <TimeMazeBoard
        question={question}
        path={path}
        optimalPath={optimalPath}
        label="Revisión del laberinto con recorrido realizado y ruta mínima."
      />
      <div className={styles.mazeLegend} aria-label="Leyenda de rutas">
        <span>
          <i className={styles.mazePlayerLine} /> Recorrido realizado
        </span>
        <span>
          <i className={styles.mazeOptimalLine} /> Ruta mínima
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={styles.answerBox}>
          <span>Movimientos realizados</span>
          <strong>{details?.moves ?? 0}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Ruta mínima</span>
          <strong>{details?.optimalMoves ?? 0}</strong>
        </div>
        <div
          className={`${styles.answerBox} ${details?.reachedExit ? styles.answerBoxCorrect : ""}`}
        >
          <span>Resultado</span>
          <strong>{details?.reachedExit ? "Salida alcanzada" : "Salida no alcanzada"}</strong>
        </div>
      </div>
    </div>
  );
}
