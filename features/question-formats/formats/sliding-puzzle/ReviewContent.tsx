import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isSlidingPuzzleAnswer } from "@/lib/scoring";
import type { SlidingPuzzleAnswer } from "@/types/gameplay";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

function SlidingPuzzleBoard({ tiles, label }: { tiles: Array<number | null>; label: string }) {
  return (
    <div className={styles.puzzleReviewBoard} aria-label={label}>
      {tiles.map((tile, index) => (
        <div
          key={`${tile ?? "blank"}-${index}`}
          className={tile === null ? styles.puzzleBlank : styles.puzzleTile}
        >
          {tile ?? ""}
        </div>
      ))}
    </div>
  );
}

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"sliding-puzzle">>) {
  const answer: SlidingPuzzleAnswer | null = isSlidingPuzzleAnswer(result.answer)
    ? (result.answer as SlidingPuzzleAnswer)
    : null;
  const details = result.details?.type === "sliding-puzzle" ? result.details : undefined;
  return (
    <div className="grid gap-3">
      <div className={styles.puzzleReviewPair}>
        <div>
          <span className={styles.memoryGridLabel}>Inicio</span>
          <SlidingPuzzleBoard tiles={question.initialTiles} label="Tablero inicial" />
        </div>
        <div>
          <span className={styles.memoryGridLabel}>Tu tablero</span>
          <SlidingPuzzleBoard
            tiles={answer?.tiles ?? question.initialTiles}
            label="Tablero final"
          />
        </div>
        <div>
          <span className={styles.memoryGridLabel}>Solución</span>
          <SlidingPuzzleBoard tiles={question.solution} label="Tablero resuelto" />
        </div>
      </div>
      <div className={styles.answerBox}>
        <span>Movimientos</span>
        <strong>{details?.moves ?? 0}</strong>
      </div>
    </div>
  );
}
