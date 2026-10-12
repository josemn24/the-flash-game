import { QuestionMedia } from "@/components/questions";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isMemoryPairsAnswer } from "@/lib/scoring";
import type { AnswerResult, MemoryPairsTile } from "@/types/gameplay";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

function getMatchedMemoryPairIds(
  question: PracticeQuestionOfType<"memory-pairs">,
  result: AnswerResult,
) {
  const answer = isMemoryPairsAnswer(result.answer) ? result.answer : null;
  const tileById = new Map(question.tiles.map((tile) => [tile.id, tile]));
  return new Set(
    answer?.attempts.flatMap(([firstId, secondId]) => {
      const first = tileById.get(firstId);
      const second = tileById.get(secondId);
      return first && second && first.id !== second.id && first.pairId === second.pairId
        ? [first.pairId]
        : [];
    }) ?? [],
  );
}

function MemoryPairsGrid({
  question,
  matchedPairIds,
  label,
  showSolution,
}: {
  question: PracticeQuestionOfType<"memory-pairs">;
  matchedPairIds: Set<string>;
  label: string;
  showSolution: boolean;
}) {
  const renderTile = (tile: MemoryPairsTile) => {
    const visible = showSolution || matchedPairIds.has(tile.pairId);
    const hasVisual = Boolean(tile.media || tile.symbol);
    return (
      <div
        key={tile.id}
        aria-label={
          visible
            ? `${tile.label}: ${matchedPairIds.has(tile.pairId) ? "encontrada" : "solución"}`
            : `${tile.label}: no encontrada`
        }
        className={`${styles.memoryPairsCell} ${visible ? styles.memoryPairsRevealed : ""} ${
          matchedPairIds.has(tile.pairId) ? styles.memoryPairsMatched : ""
        }`}
      >
        {visible ? (
          <>
            {tile.media && <QuestionMedia media={tile.media} compact />}
            {tile.symbol && (
              <span className={styles.memoryPairsSymbol} aria-hidden="true">
                {tile.symbol}
              </span>
            )}
            {!hasVisual && (
              <>
                <strong>{tile.label}</strong>
                <small>{matchedPairIds.has(tile.pairId) ? "✓ encontrada" : "solución"}</small>
              </>
            )}
          </>
        ) : (
          <>
            <strong>?</strong>
            <small>no encontrada</small>
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      <span className={styles.memoryGridLabel}>{label}</span>
      <div
        className={styles.memoryPairsGrid}
        style={{ gridTemplateColumns: `repeat(${question.grid.columns}, minmax(0, 1fr))` }}
      >
        {question.tiles.map(renderTile)}
      </div>
    </div>
  );
}

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"memory-pairs">>) {
  const answer = isMemoryPairsAnswer(result.answer) ? result.answer : null;
  const details = result.details?.type === "memory-pairs" ? result.details : undefined;
  const matchedPairIds = getMatchedMemoryPairIds(question, result);

  return (
    <div className="grid gap-3">
      <div className={styles.memoryGridPair}>
        <MemoryPairsGrid
          question={question}
          matchedPairIds={matchedPairIds}
          label="Tu tablero"
          showSolution={false}
        />
        <MemoryPairsGrid
          question={question}
          matchedPairIds={matchedPairIds}
          label="Solución"
          showSolution
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={styles.answerBox}>
          <span>Parejas encontradas</span>
          <strong>
            {details ? `${details.matchedPairs} de ${details.totalPairs}` : "Sin respuesta"}
          </strong>
        </div>
        <div className={styles.answerBox}>
          <span>Intentos</span>
          <strong>{details?.totalAttempts ?? answer?.attempts.length ?? 0}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Fallos</span>
          <strong>{details?.incorrectAttempts ?? 0}</strong>
        </div>
      </div>
    </div>
  );
}
