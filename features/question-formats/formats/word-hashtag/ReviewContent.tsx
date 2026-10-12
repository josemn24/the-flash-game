import styles from "@/components/game/shared/ReviewAnswers.module.css";
import {
  WORD_HASHTAG_ACTIVE_CELLS,
  buildWordHashtagSolution,
  isWordHashtagAnswer,
  replayWordHashtagSwaps,
} from "@/lib/wordHashtag";
import type { WordHashtagAnswer } from "@/types/gameplay";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

function WordHashtagReviewBoard({
  letters,
  solution,
  label,
}: {
  letters: Array<string | null>;
  solution: Array<string | null>;
  label: string;
}) {
  const activeCells = new Set(WORD_HASHTAG_ACTIVE_CELLS);
  return (
    <div className={styles.wordHashtagReviewBoard} aria-label={label}>
      {letters.map((letter, cell) =>
        activeCells.has(cell) ? (
          <div
            key={cell}
            className={`${styles.wordHashtagReviewTile} ${letter === solution[cell] ? styles.wordHashtagReviewCorrect : styles.wordHashtagReviewDisplaced}`}
            aria-label={`Letra ${letter ?? "vacía"}: ${letter === solution[cell] ? "posición correcta" : "posición incorrecta"}`}
          >
            <b>{letter}</b>
            <small aria-hidden="true">{letter === solution[cell] ? "✓" : "↔"}</small>
          </div>
        ) : (
          <span key={cell} aria-hidden="true" />
        ),
      )}
    </div>
  );
}

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"word-hashtag">>) {
  const answer: WordHashtagAnswer = isWordHashtagAnswer(result.answer)
    ? result.answer
    : { swaps: [] };
  const solution = buildWordHashtagSolution(question.words)!;
  const replay = replayWordHashtagSwaps(question, answer.swaps);
  const details = result.details?.type === "word-hashtag" ? result.details : undefined;
  return (
    <div className="grid gap-3">
      <div className={styles.wordHashtagReviewPair}>
        <div>
          <span className={styles.memoryGridLabel}>Tu tablero</span>
          <WordHashtagReviewBoard
            letters={replay.letters}
            solution={solution}
            label="Tablero final del jugador"
          />
        </div>
        <div>
          <span className={styles.memoryGridLabel}>Solución</span>
          <WordHashtagReviewBoard
            letters={solution}
            solution={solution}
            label="Solución del Hashtag de palabras"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className={styles.answerBox}>
          <span>Palabras</span>
          <strong>{details?.completedWords ?? 0}/4</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Letras correctas</span>
          <strong>{details?.correctCells ?? 0}/16</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Movimientos</span>
          <strong>
            {details?.movesUsed ?? answer.swaps.length} · óptimo {details?.optimalMoves ?? "—"}
          </strong>
        </div>
        <div className={`${styles.answerBox} ${details?.solved ? styles.answerBoxCorrect : ""}`}>
          <span>Restantes</span>
          <strong>{details?.movesRemaining ?? question.maxMoves}</strong>
        </div>
      </div>
    </div>
  );
}
