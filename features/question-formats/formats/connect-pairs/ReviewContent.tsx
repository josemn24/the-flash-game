import type { CSSProperties } from "react";
import {
  connectPairsRoutePoints,
  CONNECT_PAIRS_COLUMNS,
  getConnectPairsPairColor,
} from "@/lib/connectPairs";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isConnectPairsAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"connect-pairs">>) {
  const answer = isConnectPairsAnswer(result.answer) ? result.answer : null;
  const details = result.details?.type === "connect-pairs" ? result.details : undefined;
  const showSubmittedPaths = answer !== null && !result.isCorrect;
  const solutionCells = new Set(Object.values(question.solutionPaths).flat());
  const solutionOwner = new Map<number, (typeof question.pairs)[number]>();
  const submittedOwner = new Map<number, (typeof question.pairs)[number]>();

  question.pairs.forEach((pair) => {
    (question.solutionPaths[pair.id] ?? []).forEach((cell) => solutionOwner.set(cell, pair));
    (answer?.paths[pair.id] ?? []).forEach((cell) => submittedOwner.set(cell, pair));
  });

  const reviewStatus = result.isCorrect
    ? "Solución completa"
    : answer === null || result.status === "unanswered"
      ? "Sin respuesta"
      : result.status === "partial"
        ? "Respuesta parcial"
        : "Respuesta incorrecta";

  const pathLayerLabel = showSubmittedPaths
    ? "Muestra la solución oficial y tu respuesta"
    : result.isCorrect
      ? "Muestra la solución oficial, coincidente con tu respuesta"
      : "Muestra la solución oficial";

  return (
    <div className="grid gap-3">
      <div
        className={styles.connectPairsReviewGrid}
        style={{ gridTemplateColumns: `repeat(${CONNECT_PAIRS_COLUMNS}, minmax(0, 1fr))` }}
        aria-label={`Tablero de conexiones. ${pathLayerLabel}.`}
      >
        <svg
          className={styles.connectPairsReviewRouteOverlay}
          viewBox={`0 0 ${CONNECT_PAIRS_COLUMNS} ${question.grid.rows}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {question.pairs.map((pair, index) => {
            const solutionPath = question.solutionPaths[pair.id] ?? [];
            const color = getConnectPairsPairColor(pair.color, index);
            return solutionPath.length > 1 ? (
              <polyline
                key={`solution-${pair.id}`}
                className={styles.connectPairsReviewRouteLine}
                points={connectPairsRoutePoints(solutionPath)}
                style={{ "--pair-color": color } as CSSProperties}
              />
            ) : null;
          })}
          {showSubmittedPaths
            ? question.pairs.map((pair, index) => {
                const submittedPath = answer?.paths[pair.id] ?? [];
                const color = getConnectPairsPairColor(pair.color, index);
                return submittedPath.length > 1 ? (
                  <polyline
                    key={`submitted-${pair.id}`}
                    className={styles.connectPairsReviewSubmittedLine}
                    points={connectPairsRoutePoints(submittedPath)}
                    style={{ "--pair-color": color } as CSSProperties}
                  />
                ) : null;
              })
            : null}
        </svg>
        {Array.from({ length: question.grid.rows * question.grid.columns }, (_, cell) => {
          const owner = solutionOwner.get(cell);
          const submittedPair = submittedOwner.get(cell);
          const isEndpoint = owner ? owner.endpoints.includes(cell) : false;
          const answerIncludesEndpoint = owner?.endpoints.some((endpoint) =>
            (answer?.paths[owner.id] ?? []).includes(endpoint),
          );
          const color = owner
            ? getConnectPairsPairColor(
                owner.color,
                question.pairs.findIndex((pair) => pair.id === owner.id),
              )
            : undefined;
          return (
            <span
              key={cell}
              className={`${styles.connectPairsReviewCell} ${isEndpoint ? styles.connectPairsReviewEndpoint : ""} ${
                isEndpoint && showSubmittedPaths && !answerIncludesEndpoint
                  ? styles.connectPairsReviewEndpointMissing
                  : ""
              }`}
              style={{ "--pair-color": color } as CSSProperties}
              aria-label={
                owner
                  ? `Casilla ${cell + 1}: ${isEndpoint ? "extremo" : "ruta"} de ${owner.label}${
                      showSubmittedPaths && submittedPair && submittedPair.id !== owner.id
                        ? `; tu respuesta la asigna a ${submittedPair.label}`
                        : showSubmittedPaths && isEndpoint && !answerIncludesEndpoint
                          ? "; extremo no incluido en tu respuesta"
                          : ""
                    }`
                  : `Casilla ${cell + 1}: vacía`
              }
            >
              {owner ? (isEndpoint ? owner.symbol : solutionCells.has(cell) ? "·" : "") : ""}
            </span>
          );
        })}
      </div>
      <div className={styles.connectPairsReviewLegend} aria-label="Leyenda de conexiones">
        <div className={styles.connectPairsReviewPairLegend}>
          {question.pairs.map((pair, index) => {
            const color = getConnectPairsPairColor(pair.color, index);
            return (
              <div key={pair.id} className={styles.connectPairsReviewLegendItem}>
                <span
                  className={styles.connectPairsReviewLegendSymbol}
                  style={{ "--pair-color": color } as CSSProperties}
                  aria-hidden="true"
                >
                  {pair.symbol}
                </span>
                <span>{pair.label}</span>
              </div>
            );
          })}
        </div>
        <div className={styles.connectPairsReviewLineLegend}>
          <span className={styles.connectPairsReviewLegendLine} aria-hidden="true" />
          <span>Solución</span>
          {showSubmittedPaths ? (
            <>
              <span
                className={`${styles.connectPairsReviewLegendLine} ${styles.connectPairsReviewLegendLineSubmitted}`}
                aria-hidden="true"
              />
              <span>Tu respuesta</span>
            </>
          ) : result.isCorrect ? (
            <span>Tu respuesta: coincide</span>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={styles.answerBox}>
          <span>Parejas conectadas</span>
          <strong>
            {details?.connectedPairs ?? 0}/{details?.totalPairs ?? question.pairs.length}
          </strong>
        </div>
        <div className={styles.answerBox}>
          <span>Cobertura</span>
          <strong>{details ? `${Math.round(details.coverage * 100)} %` : "0 %"}</strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Estado</span>
          <strong>{reviewStatus}</strong>
        </div>
      </div>
    </div>
  );
}
