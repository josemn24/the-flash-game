import type { CSSProperties } from "react";
import {
  calculateConnectPairsMetrics,
  connectPairsRoutePoints,
  getConnectPairsPairColor,
  isRestorableConnectPairsDraft,
} from "@/lib/connectPairs";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isConnectPairsAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"connect-pairs">>) {
  const storedAnswer = isConnectPairsAnswer(result.answer) ? result.answer : null;
  const savedDraft =
    result.reviewState?.type === "connect-pairs" &&
    isRestorableConnectPairsDraft(question, { paths: result.reviewState.paths })
      ? {
          paths: Object.fromEntries(
            Object.entries(result.reviewState.paths).map(([id, path]) => [id, [...path]]),
          ),
        }
      : null;
  const answer = storedAnswer ?? savedDraft;
  const details =
    (storedAnswer || !savedDraft) && result.details?.type === "connect-pairs"
      ? result.details
      : undefined;
  const metrics = answer ? calculateConnectPairsMetrics(question, answer) : null;
  const reviewMetrics = {
    connectedPairs: details?.connectedPairs ?? metrics?.connectedPairs ?? 0,
    totalPairs: details?.totalPairs ?? question.pairs.length,
    coverage: details?.coverage ?? metrics?.coverageRatio ?? 0,
  };
  const matchesSolution =
    answer !== null &&
    question.pairs.every((pair) => {
      const submitted = (answer.paths[pair.id] ?? []).join(",");
      const solution = question.solutionPaths[pair.id] ?? [];
      return submitted === solution.join(",") || submitted === [...solution].reverse().join(",");
    });
  const showSubmittedPaths =
    savedDraft !== null || (answer !== null && (!result.isCorrect || !matchesSolution));
  const solutionCells = new Set(Object.values(question.solutionPaths).flat());
  const solutionOwner = new Map<number, (typeof question.pairs)[number]>();
  const submittedOwner = new Map<number, (typeof question.pairs)[number]>();

  question.pairs.forEach((pair) => {
    (question.solutionPaths[pair.id] ?? []).forEach((cell) => solutionOwner.set(cell, pair));
    (answer?.paths[pair.id] ?? []).forEach((cell) => submittedOwner.set(cell, pair));
  });

  const reviewStatus = result.isCorrect
    ? "Solución completa"
    : savedDraft === null && (answer === null || result.status === "unanswered")
      ? "Sin respuesta"
      : savedDraft !== null || result.status === "partial"
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
        style={{ gridTemplateColumns: `repeat(${question.grid.columns}, minmax(0, 1fr))` }}
        aria-label={`Tablero de conexiones ${question.grid.rows}×${question.grid.columns}. ${pathLayerLabel}.`}
      >
        <svg
          className={styles.connectPairsReviewRouteOverlay}
          viewBox={`0 0 ${question.grid.columns} ${question.grid.rows}`}
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
                points={connectPairsRoutePoints(solutionPath, question.grid)}
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
                    points={connectPairsRoutePoints(submittedPath, question.grid)}
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
              } ${submittedPair && showSubmittedPaths ? styles.connectPairsReviewSubmittedCell : ""}`}
              style={
                {
                  "--pair-color": color,
                  "--submitted-pair-color": submittedPair
                    ? getConnectPairsPairColor(
                        submittedPair.color,
                        question.pairs.findIndex((pair) => pair.id === submittedPair.id),
                      )
                    : undefined,
                } as CSSProperties
              }
              aria-label={
                owner
                  ? `Casilla ${cell + 1}: ${isEndpoint ? "extremo" : "ruta"} de ${owner.label}${
                      showSubmittedPaths && submittedPair && submittedPair.id !== owner.id
                        ? `; tu respuesta la asigna a ${submittedPair.label}`
                        : showSubmittedPaths && isEndpoint && !answerIncludesEndpoint
                          ? "; extremo no incluido en tu respuesta"
                          : ""
                    }`
                  : submittedPair && showSubmittedPaths
                    ? `Casilla ${cell + 1}: tu ruta de ${submittedPair.label}`
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
            {reviewMetrics.connectedPairs}/{reviewMetrics.totalPairs}
          </strong>
        </div>
        <div className={styles.answerBox}>
          <span>Cobertura</span>
          <strong>{Math.round(reviewMetrics.coverage * 100)} %</strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Estado</span>
          <strong>{reviewStatus}</strong>
        </div>
      </div>
    </div>
  );
}
