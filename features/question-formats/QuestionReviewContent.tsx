import type { ComponentType } from "react";
import { HeatMapSurface } from "@/components/HeatMapQuestion";
import { QuestionMedia } from "@/components/QuestionMedia";
import { TimeMazeBoard } from "@/components/TimeMazeQuestion";
import { CONNECT_PAIRS_COLUMNS } from "@/lib/connectPairs";
import {
  AssignAllImageLabelingReviewSurface,
  IdentifyOneImageLabelingReviewSurface,
} from "@/components/ImageLabelingQuestion";
import styles from "@/components/ReviewAnswers.module.css";
import {
  isClassificationAnswer,
  isConnectPairsAnswer,
  isErrorReconstructionAnswer,
  isFlashMemoryAnswer,
  isImageLabelingAnswer,
  isMatchingAnswer,
  isMemoryPairsAnswer,
  isMiniNonogramAnswer,
  isMiniSudokuAnswer,
  isMiniWordleAnswer,
  isSlidingPuzzleAnswer,
  isSimonSequenceAnswer,
  isTimeMazeAnswer,
} from "@/lib/scoring";
import { getMiniWordleFeedback } from "@/lib/miniWordle";
import { calculateProgressiveImageReveal } from "@/lib/progressiveImage";
import { findShortestTimeMazePath, getTimeMazeStartIndex } from "@/lib/timeMaze";
import type {
  AnswerResult,
  AnswerValue,
  MemoryPairsTile,
  MiniSudokuAnswer,
  SlidingPuzzleAnswer,
  MiniNonogramAnswer,
  Question,
  QuestionOfType,
  QuestionType,
} from "@/types/game";

type ReviewProps<T extends Question = Question> = { question: T; result: AnswerResult };

function answerLabel(value: AnswerValue | null) {
  if (value === null) return "Sin respuesta";
  if (Array.isArray(value)) return value.join(" → ");
  if (typeof value === "boolean") return value ? "Verdadero" : "Falso";
  if (typeof value === "object") return "Clasificación completada";
  return value;
}

function categoryLabel(category: string | undefined) {
  if (!category) return "Sin respuesta";
  return category.charAt(0).toLocaleUpperCase("es") + category.slice(1);
}

function AnswerPair({ answer, correct }: { answer: AnswerValue | null; correct: AnswerValue }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={styles.answerBox}>
        <span>Tu respuesta</span>
        <strong>{answerLabel(answer)}</strong>
      </div>
      <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
        <span>Respuesta correcta</span>
        <strong>{answerLabel(correct)}</strong>
      </div>
    </div>
  );
}

function ChoiceReview({ question, result }: ReviewProps<QuestionOfType<"multiple-choice">>) {
  return <AnswerPair answer={result.answer} correct={question.correctAnswer} />;
}

function OddOneOutReview({ question, result }: ReviewProps<QuestionOfType<"odd-one-out">>) {
  const labelFor = (id: AnswerValue | null) =>
    typeof id === "string"
      ? (question.items.find((item) => item.id === id)?.label ?? "Respuesta no válida")
      : null;

  return (
    <AnswerPair
      answer={labelFor(result.answer)}
      correct={labelFor(question.correctAnswer) ?? question.correctAnswer}
    />
  );
}

function MatchingReview({ question, result }: ReviewProps<QuestionOfType<"matching">>) {
  const answer = isMatchingAnswer(result.answer) ? result.answer : null;
  return (
    <div className={styles.classificationReviewList}>
      {question.leftItems.map((item) => {
        const chosenId = answer?.[item.id];
        const chosenLabel = question.rightItems.find((right) => right.id === chosenId)?.label;
        const correctLabel = question.rightItems.find(
          (right) => right.id === item.correctMatchId,
        )?.label;
        const correct = chosenId === item.correctMatchId;
        return (
          <div key={item.id} className={styles.classificationReviewRow}>
            <strong>{item.label}</strong>
            <span>
              <small>Emparejada</small>
              <b
                className={
                  correct ? styles.classificationValueCorrect : styles.classificationValueWrong
                }
              >
                {chosenLabel ?? "Sin emparejar"}
              </b>
            </span>
            <span>
              <small>Correcta</small>
              <b className={styles.classificationValueCorrect}>{correctLabel}</b>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ConnectPairsReview({ question, result }: ReviewProps<QuestionOfType<"connect-pairs">>) {
  const answer = isConnectPairsAnswer(result.answer) ? result.answer : null;
  const details = result.details?.type === "connect-pairs" ? result.details : undefined;
  const cellOwner = new Map<
    number,
    { symbol: string; label: string; isEndpoint: boolean; inAnswer: boolean }
  >();

  question.pairs.forEach((pair) => {
    pair.endpoints.forEach((endpoint) =>
      cellOwner.set(endpoint, {
        symbol: pair.symbol,
        label: pair.label,
        isEndpoint: true,
        inAnswer: false,
      }),
    );
    (answer?.paths[pair.id] ?? []).forEach((cell) => {
      cellOwner.set(cell, {
        symbol: pair.symbol,
        label: pair.label,
        isEndpoint: pair.endpoints.includes(cell),
        inAnswer: true,
      });
    });
  });

  return (
    <div className="grid gap-3">
      <div
        className={styles.connectPairsReviewGrid}
        style={{ gridTemplateColumns: `repeat(${CONNECT_PAIRS_COLUMNS}, minmax(0, 1fr))` }}
        aria-label="Rutas enviadas"
      >
        {Array.from({ length: question.grid.rows * question.grid.columns }, (_, cell) => {
          const owner = cellOwner.get(cell);
          return (
            <span
              key={cell}
              className={`${styles.connectPairsReviewCell} ${
                owner?.inAnswer ? styles.connectPairsReviewRoute : ""
              } ${owner?.isEndpoint ? styles.connectPairsReviewEndpoint : ""} ${
                owner?.isEndpoint && !owner.inAnswer ? styles.connectPairsReviewEndpointMissing : ""
              }`}
              aria-label={
                owner
                  ? `Casilla ${cell + 1}: ${
                      owner.isEndpoint && !owner.inAnswer
                        ? "extremo no incluido en la ruta enviada"
                        : owner.isEndpoint
                          ? "extremo incluido en la ruta enviada"
                          : "ruta enviada"
                    } de ${owner.label}`
                  : `Casilla ${cell + 1}: vacía`
              }
            >
              {owner?.isEndpoint ? owner.symbol : owner?.inAnswer ? "•" : ""}
            </span>
          );
        })}
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
          <span>Solución</span>
          <strong>
            {question.requireFullCoverage ? "Cobertura completa" : "Parejas conectadas"}
          </strong>
        </div>
      </div>
    </div>
  );
}

function TrueFalseReview({ question, result }: ReviewProps<QuestionOfType<"true-false">>) {
  return <AnswerPair answer={result.answer} correct={question.correctAnswer} />;
}

function ShortTextReview({ question, result }: ReviewProps<QuestionOfType<"short-text">>) {
  return <AnswerPair answer={result.answer} correct={question.correctAnswer} />;
}

function ProgressiveCluesReview({
  question,
  result,
}: ReviewProps<QuestionOfType<"progressive-clues">>) {
  const details = result.details?.type === "progressive-clues" ? result.details : undefined;
  return (
    <div className="grid gap-3">
      <AnswerPair answer={result.answer} correct={question.correctAnswer} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Pistas utilizadas</span>
          <strong>
            {details ? `${details.revealedClues} de ${details.totalClues}` : "Sin datos"}
          </strong>
        </div>
        <div className={styles.answerBox}>
          <span>Máximo disponible</span>
          <strong>{details ? `${details.availablePoints} pts` : "—"}</strong>
        </div>
      </div>
    </div>
  );
}

function ProgressiveImageReview({
  question,
  result,
}: ReviewProps<QuestionOfType<"progressive-image">>) {
  const revealedPercentage = Math.round(
    calculateProgressiveImageReveal(result.timeUsed, question.revealDuration) * 100,
  );

  return (
    <div className="grid gap-3">
      <QuestionMedia
        compact
        media={{
          type: "image",
          src: question.surface.src,
          alt: question.solutionAlt,
          fit: question.surface.fit,
          position: question.surface.position,
        }}
      />
      <AnswerPair answer={result.answer} correct={question.correctAnswer} />
      <div className={styles.answerBox}>
        <span>Imagen revelada al responder</span>
        <strong>{result.answer === null ? "Sin respuesta" : `${revealedPercentage} %`}</strong>
      </div>
    </div>
  );
}

function HeatMapReview({ question, result }: ReviewProps<QuestionOfType<"heat-map">>) {
  const details = result.details?.type === "heat-map" ? result.details : undefined;

  return (
    <div className="grid gap-3">
      <HeatMapSurface
        surface={question.surface}
        selectedPoint={details?.selectedPoint}
        targetPoint={question.target}
        fullCreditRadius={question.fullCreditRadius}
        toleranceRadius={question.toleranceRadius}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={styles.answerBox}>
          <span>Tu selección</span>
          <strong>{details ? "Punto sobre la imagen" : "Sin respuesta"}</strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Zona objetivo</span>
          <strong>{question.targetLabel}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Precisión</span>
          <strong>{details ? `${Math.round(details.accuracy * 100)} %` : "—"}</strong>
          {details && (
            <small>Distancia: {(details.distance * 100).toFixed(1)} % del lado corto</small>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageLabelingReview({ question, result }: ReviewProps<QuestionOfType<"image-labeling">>) {
  if (question.task === "identify-one") {
    const answer = typeof result.answer === "string" ? result.answer : null;
    return (
      <div className="grid gap-3">
        <IdentifyOneImageLabelingReviewSurface
          question={question}
          answer={answer}
          isCorrect={result.isCorrect}
        />
        <AnswerPair answer={answer} correct={question.response.correctAnswer} />
      </div>
    );
  }

  const answer = isImageLabelingAnswer(result.answer) ? result.answer : null;
  const details =
    result.details?.type === "image-labeling" && result.details.task === "assign-all"
      ? result.details
      : undefined;

  return (
    <div className="grid gap-3">
      <AssignAllImageLabelingReviewSurface question={question} answer={answer} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Etiquetas correctas</span>
          <strong>
            {details ? `${details.correctLabels} de ${details.totalLabels}` : "Sin respuesta"}
          </strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Resultado</span>
          <strong>
            {details ? `${Math.round((details.correctLabels / details.totalLabels) * 100)} %` : "—"}
          </strong>
        </div>
      </div>
    </div>
  );
}

function OrderingReview({ question, result }: ReviewProps<QuestionOfType<"ordering">>) {
  return <AnswerPair answer={result.answer} correct={question.correctOrder} />;
}

function EstimationReview({ question, result }: ReviewProps<QuestionOfType<"estimation">>) {
  const details = result.details?.type === "estimation" ? result.details : undefined;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className={styles.answerBox}>
        <span>Tu estimación</span>
        <strong>
          {typeof result.answer === "number"
            ? `${result.answer} ${question.unit}`
            : "Sin respuesta"}
        </strong>
      </div>
      <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
        <span>Valor real</span>
        <strong>
          {question.correctAnswer} {question.unit}
        </strong>
      </div>
      <div className={styles.answerBox}>
        <span>Diferencia</span>
        <strong>
          {typeof result.answer !== "number" || !details
            ? "—"
            : details.difference === 0
              ? "Exacta"
              : `${details.difference} ${question.unit} ${result.answer > question.correctAnswer ? "por encima" : "por debajo"}`}
        </strong>
      </div>
    </div>
  );
}

function LogicCodeReview({ question, result }: ReviewProps<QuestionOfType<"logic-code">>) {
  const details = result.details?.type === "logic-code" ? result.details : undefined;
  return (
    <div>
      <div className={styles.logicReviewClues}>
        {question.clues.map((clue) => (
          <div key={clue.code}>
            <strong>{clue.code}</strong>
            <span>{clue.hint}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Códigos enviados</span>
          {details?.submittedCodes.length ? (
            <div className={styles.logicReviewAttempts}>
              {details.submittedCodes.map((code, index) => (
                <b
                  key={`${code}-${index}`}
                  className={
                    index === details.submittedCodes.length - 1 ? styles.logicReviewLast : ""
                  }
                >
                  {code}
                </b>
              ))}
            </div>
          ) : (
            <strong>Sin respuesta</strong>
          )}
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Solución</span>
          <strong>{question.correctAnswer}</strong>
        </div>
      </div>
    </div>
  );
}

function ClassificationReview({ question, result }: ReviewProps<QuestionOfType<"classification">>) {
  const answer = isClassificationAnswer(result.answer) ? result.answer : null;
  return (
    <div className={styles.classificationReviewList}>
      {question.items.map((item) => {
        const chosenCategory = answer?.[item.label];
        const correct = chosenCategory === item.correctCategory;
        return (
          <div key={item.label} className={styles.classificationReviewRow}>
            <strong>{item.label}</strong>
            <span>
              <small>Elegida</small>
              <b
                className={
                  correct ? styles.classificationValueCorrect : styles.classificationValueWrong
                }
              >
                {categoryLabel(chosenCategory)}
              </b>
            </span>
            <span>
              <small>Correcta</small>
              <b className={styles.classificationValueCorrect}>
                {categoryLabel(item.correctCategory)}
              </b>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FlashMemoryGrid({
  question,
  answer,
  label,
  showSolution,
}: {
  question: QuestionOfType<"flash-memory">;
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

function FlashMemoryReview({ question, result }: ReviewProps<QuestionOfType<"flash-memory">>) {
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

function getMatchedMemoryPairIds(question: QuestionOfType<"memory-pairs">, result: AnswerResult) {
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
  question: QuestionOfType<"memory-pairs">;
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

function MemoryPairsReview({ question, result }: ReviewProps<QuestionOfType<"memory-pairs">>) {
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

function SimonSequenceReview({ question, result }: ReviewProps<QuestionOfType<"simon-sequence">>) {
  const submittedSteps = isSimonSequenceAnswer(result.answer) ? result.answer : [];
  const details = result.details?.type === "simon-sequence" ? result.details : undefined;
  const labelFor = (step: string) => question.pads.find((pad) => pad.id === step)?.label ?? step;
  const mismatch = details?.firstMismatchIndex;
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Tu secuencia</span>
          <strong>
            {submittedSteps.length ? submittedSteps.map(labelFor).join(" → ") : "Sin respuesta"}
          </strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Secuencia correcta</span>
          <strong>{question.sequence.map(labelFor).join(" → ")}</strong>
        </div>
      </div>
      {mismatch !== null && mismatch !== undefined && submittedSteps.length > 0 && (
        <div className={styles.answerBox}>
          <span>Primer paso divergente</span>
          <strong>Paso {mismatch + 1}</strong>
        </div>
      )}
    </div>
  );
}

function LogicMatrixReview({ question, result }: ReviewProps<QuestionOfType<"logic-matrix">>) {
  const piecesById = new Map(question.pieces.map((piece) => [piece.id, piece]));
  const labelFor = (pieceId: string | null) =>
    pieceId ? (piecesById.get(pieceId)?.label ?? pieceId) : "Casilla vacía";
  const completedCells = question.cells.map((cell) => cell ?? question.correctOptionId);
  const answer = typeof result.answer === "string" ? result.answer : null;
  return (
    <div className="grid gap-3">
      <div className={styles.logicMatrixReviewGrid} aria-label="Matriz completada">
        {completedCells.map((pieceId, index) => {
          const piece = piecesById.get(pieceId);
          return (
            <div key={index} className={styles.logicMatrixReviewCell}>
              <span aria-hidden="true">{piece?.symbol}</span>
              <small>{labelFor(pieceId)}</small>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Tu elección</span>
          <strong>{labelFor(answer)}</strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Pieza correcta</span>
          <strong>{labelFor(question.correctOptionId)}</strong>
        </div>
      </div>
    </div>
  );
}

function MiniSudokuReview({ question, result }: ReviewProps<QuestionOfType<"mini-sudoku">>) {
  const answer: MiniSudokuAnswer | null = isMiniSudokuAnswer(result.answer)
    ? (result.answer as MiniSudokuAnswer)
    : null;
  const details = result.details?.type === "mini-sudoku" ? result.details : undefined;
  return (
    <div className="grid gap-3">
      <div className={styles.sudokuReviewGrid} aria-label="Sudoku completado con la solución">
        {question.solution.map((correctValue, index) => {
          const isBlank = question.grid[index] === null;
          const chosenValue = isBlank ? answer?.[String(index)] : question.grid[index];
          const status = !isBlank
            ? styles.sudokuGiven
            : chosenValue === correctValue
              ? styles.sudokuCorrect
              : styles.sudokuWrong;
          return (
            <div key={index} className={`${styles.sudokuReviewCell} ${status}`}>
              <span>{correctValue}</span>
              {isBlank && <small>Tu valor: {chosenValue ?? "—"}</small>}
            </div>
          );
        })}
      </div>
      <div className={styles.answerBox}>
        <span>Casillas correctas</span>
        <strong>
          {details ? `${details.correctCells} de ${details.totalCells}` : "Sin datos"}
        </strong>
      </div>
    </div>
  );
}

function MiniNonogramReview({ question, result }: ReviewProps<QuestionOfType<"mini-nonogram">>) {
  const answer: MiniNonogramAnswer | null = isMiniNonogramAnswer(result.answer)
    ? (result.answer as MiniNonogramAnswer)
    : null;
  const details = result.details?.type === "mini-nonogram" ? result.details : undefined;
  return (
    <div className="grid gap-3">
      <div className={styles.nonogramReviewGrid} aria-label="Solución del nonograma">
        {question.solution.map((isFilled, index) => {
          const selected = answer?.[String(index)] === true;
          const status = selected
            ? isFilled
              ? styles.nonogramCorrect
              : styles.nonogramWrong
            : isFilled
              ? styles.nonogramMissing
              : styles.nonogramEmpty;
          return (
            <div key={index} className={`${styles.nonogramReviewCell} ${status}`}>
              <span aria-hidden="true">{isFilled ? "●" : ""}</span>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={styles.answerBox}>
          <span>Rellenos correctos</span>
          <strong>{details?.correctFilled ?? 0}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Rellenos erróneos</span>
          <strong>{details?.incorrectFilled ?? 0}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Total objetivo</span>
          <strong>{details?.totalFilled ?? 0}</strong>
        </div>
      </div>
    </div>
  );
}

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

function SlidingPuzzleReview({ question, result }: ReviewProps<QuestionOfType<"sliding-puzzle">>) {
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

function TimeMazeReview({ question, result }: ReviewProps<QuestionOfType<"time-maze">>) {
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

function ErrorReconstructionReview({
  question,
  result,
}: ReviewProps<QuestionOfType<"error-reconstruction">>) {
  const answer = isErrorReconstructionAnswer(result.answer) ? result.answer : null;
  const details = result.details?.type === "error-reconstruction" ? result.details : undefined;
  const selectedStep = question.steps.find((step) => step.id === answer?.stepId);
  const correctStep = question.steps.find((step) => step.id === question.firstErrorStepId)!;

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Tu primer error</span>
          <strong>{selectedStep?.text ?? "Sin respuesta"}</strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Primer error real</span>
          <strong>{correctStep.text}</strong>
        </div>
      </div>
      {question.correction && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={styles.answerBox}>
            <span>Tu corrección</span>
            <strong>{answer?.correction ?? "Sin corrección"}</strong>
          </div>
          <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
            <span>Corrección esperada</span>
            <strong>{question.correction.correctAnswer}</strong>
          </div>
        </div>
      )}
      <div className={styles.answerBox}>
        <span>Resultado de la localización</span>
        <strong>
          {details?.locationCorrect ? "Primer error localizado" : "Primer error no localizado"}
        </strong>
      </div>
    </div>
  );
}

function AnagramReview({ question, result }: ReviewProps<QuestionOfType<"anagram">>) {
  return <AnswerPair answer={result.answer} correct={question.correctAnswer} />;
}

function MiniWordleReview({ question, result }: ReviewProps<QuestionOfType<"mini-wordle">>) {
  const answer = isMiniWordleAnswer(result.answer) ? result.answer : null;
  const details = result.details?.type === "mini-wordle" ? result.details : undefined;
  return (
    <div className="grid gap-3">
      {answer?.guesses.length ? (
        <div className={styles.wordleReview} aria-label="Intentos realizados">
          {answer.guesses.map((guess, rowIndex) => (
            <div key={`${guess}-${rowIndex}`} className={styles.wordleReviewRow}>
              {getMiniWordleFeedback(guess, question.correctAnswer).map((item, index) => (
                <span
                  key={`${item.letter}-${index}`}
                  className={`${styles.wordleReviewTile} ${styles[`wordle-${item.status}`]}`}
                  aria-label={`${item.letter}: ${
                    item.status === "correct"
                      ? "posición correcta"
                      : item.status === "present"
                        ? "está en otra posición"
                        : "no está en la palabra"
                  }`}
                >
                  {item.letter}
                  <small aria-hidden="true">
                    {item.status === "correct" ? "✓" : item.status === "present" ? "↔" : "×"}
                  </small>
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.answerBox}>Sin intentos enviados</div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Intentos utilizados</span>
          <strong>{details?.attemptsUsed ?? 0} de 4</strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Solución</span>
          <strong>{question.correctAnswer}</strong>
        </div>
      </div>
    </div>
  );
}

export const QUESTION_REVIEW_RENDERERS = {
  "multiple-choice": ChoiceReview,
  "odd-one-out": OddOneOutReview,
  matching: MatchingReview,
  "connect-pairs": ConnectPairsReview,
  "true-false": TrueFalseReview,
  "short-text": ShortTextReview,
  "progressive-clues": ProgressiveCluesReview,
  "progressive-image": ProgressiveImageReview,
  "heat-map": HeatMapReview,
  "image-labeling": ImageLabelingReview,
  ordering: OrderingReview,
  classification: ClassificationReview,
  "flash-memory": FlashMemoryReview,
  "memory-pairs": MemoryPairsReview,
  "simon-sequence": SimonSequenceReview,
  "logic-matrix": LogicMatrixReview,
  "mini-sudoku": MiniSudokuReview,
  "mini-nonogram": MiniNonogramReview,
  "time-maze": TimeMazeReview,
  "sliding-puzzle": SlidingPuzzleReview,
  "error-reconstruction": ErrorReconstructionReview,
  anagram: AnagramReview,
  "mini-wordle": MiniWordleReview,
  "logic-code": LogicCodeReview,
  estimation: EstimationReview,
} satisfies { [T in QuestionType]: ComponentType<ReviewProps<QuestionOfType<T>>> };

export function QuestionReviewContent(props: ReviewProps) {
  const Renderer = QUESTION_REVIEW_RENDERERS[props.question.type] as ComponentType<ReviewProps>;
  return <Renderer {...props} />;
}
