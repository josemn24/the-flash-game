import { QuestionMedia } from "@/components/questions";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isFlashMemoryAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

function FlashMemoryGrid({
  question,
  answer,
  label,
  showSolution,
}: {
  question: PracticeQuestionOfType<"flash-memory">;
  answer: Record<string, string> | null;
  label: string;
  showSolution: boolean;
}) {
  const itemById = new Map(question.items.map((item) => [item.id, item]));
  const positions = Array.from(
    { length: question.grid.rows * question.grid.columns },
    (_, index) => index,
  );
  return (
    <div>
      <span className={styles.memoryGridLabel}>{label}</span>
      <div
        className={styles.memoryGrid}
        style={{ gridTemplateColumns: `repeat(${question.grid.columns}, minmax(0, 1fr))` }}
      >
        {positions.map((position) => {
          const item = showSolution
            ? question.items.find((candidate) => candidate.correctPosition === position)
            : answer
              ? itemById.get(answer[String(position)])
              : undefined;
          return (
            <div key={position} className={styles.memoryCell}>
              {item ? (
                <>
                  {item.media && <QuestionMedia media={item.media} />}
                  <strong>{item.label}</strong>
                </>
              ) : (
                <span>Vacía</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"flash-memory">>) {
  const answer = isFlashMemoryAnswer(result.answer) ? result.answer : null;
  const details = result.details?.type === "flash-memory" ? result.details : undefined;
  return (
    <div className="grid gap-3">
      <div className={styles.memoryGridPair}>
        <FlashMemoryGrid
          question={question}
          answer={answer}
          label="Tu reconstrucción"
          showSolution={false}
        />
        <FlashMemoryGrid
          question={question}
          answer={null}
          label="Composición correcta"
          showSolution
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Posiciones correctas</span>
          <strong>
            {details
              ? `${details.correctPlacements} de ${details.totalPlacements}`
              : "Sin respuesta"}
          </strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Exposición</span>
          <strong>{question.revealDuration} s</strong>
        </div>
      </div>
    </div>
  );
}
