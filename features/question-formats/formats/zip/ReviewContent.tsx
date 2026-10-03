import { ZipBoard } from "@/components/questions";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isZipAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({ question, result }: ReviewProps<PracticeQuestionOfType<"zip">>) {
  const answer = isZipAnswer(result.answer) ? result.answer : null;
  const details = result.details?.type === "zip" ? result.details : undefined;
  const path = answer?.path ?? [question.checkpoints[0].cell];

  return (
    <div className="grid gap-3">
      <ZipBoard
        question={question}
        path={path}
        solutionPath={question.solution}
        variant="review"
        label="Revisión de Zip con recorrido realizado y solución correcta."
      />
      <div className={styles.mazeLegend} aria-label="Leyenda de rutas">
        <span>
          <i className={styles.zipPlayerLine} /> Recorrido realizado
        </span>
        <span>
          <i className={styles.zipSolutionLine} /> Solución
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={styles.answerBox}>
          <span>Celdas recorridas</span>
          <strong>
            {details?.coveredCells ?? path.length}/{details?.totalCells ?? 25}
          </strong>
        </div>
        <div className={styles.answerBox}>
          <span>Número alcanzado</span>
          <strong>
            {details?.reachedCheckpoint ?? 1}/
            {details?.totalCheckpoints ?? question.checkpoints.length}
          </strong>
        </div>
        <div className={`${styles.answerBox} ${details?.completed ? styles.answerBoxCorrect : ""}`}>
          <span>Resultado</span>
          <strong>{details?.completed ? "Recorrido completo" : "Recorrido incompleto"}</strong>
        </div>
      </div>
    </div>
  );
}
