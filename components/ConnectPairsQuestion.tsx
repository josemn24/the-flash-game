"use client";

import { KeyboardEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  applyConnectPairsCellSelection,
  calculateConnectPairsMetrics,
  CONNECT_PAIRS_COLUMNS,
  CONNECT_PAIRS_ROWS,
  isRestorableConnectPairsDraft,
} from "@/lib/connectPairs";
import type {
  ConnectPairsAnswer,
  ConnectPairsPair,
  ConnectPairsQuestion as Question,
} from "@/types/game";
import styles from "@/components/ConnectPairsQuestion.module.css";

const DEFAULT_COLORS = ["#35e8ff", "#d7ff18", "#ff6d73", "#43deb7", "#b994ff"];

type CellOwner = {
  pair: ConnectPairsPair;
  isEndpoint: boolean;
};

function neighborForKey(index: number, key: string) {
  const row = Math.floor(index / CONNECT_PAIRS_COLUMNS);
  const column = index % CONNECT_PAIRS_COLUMNS;
  if (key === "ArrowUp" && row > 0) return index - CONNECT_PAIRS_COLUMNS;
  if (key === "ArrowDown" && row < CONNECT_PAIRS_ROWS - 1) return index + CONNECT_PAIRS_COLUMNS;
  if (key === "ArrowLeft" && column > 0) return index - 1;
  if (key === "ArrowRight" && column < CONNECT_PAIRS_COLUMNS - 1) return index + 1;
  return null;
}

function areNeighbors(left: number, right: number) {
  return (
    neighborForKey(left, "ArrowUp") === right ||
    neighborForKey(left, "ArrowDown") === right ||
    neighborForKey(left, "ArrowLeft") === right ||
    neighborForKey(left, "ArrowRight") === right
  );
}

function hasProgress(paths: Record<string, number[]>) {
  return Object.values(paths).some((path) => path.length > 1);
}

function routePoints(path: number[]) {
  return path
    .map((cell) => {
      const row = Math.floor(cell / CONNECT_PAIRS_COLUMNS);
      const column = cell % CONNECT_PAIRS_COLUMNS;
      return `${column + 0.5},${row + 0.5}`;
    })
    .join(" ");
}

export function ConnectPairsQuestion({
  question,
  initialAnswer,
  locked,
  onProgress,
  onSubmit,
}: {
  question: Question;
  initialAnswer?: ConnectPairsAnswer;
  locked: boolean;
  onProgress: (answer: ConnectPairsAnswer) => void;
  onSubmit: (answer: ConnectPairsAnswer) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<Record<string, number[]>>(() =>
    isRestorableConnectPairsDraft(question, initialAnswer)
      ? Object.fromEntries(
          Object.entries(initialAnswer.paths).map(([pairId, path]) => [pairId, [...path]]),
        )
      : {},
  );
  const [activePairId, setActivePairId] = useState(question.pairs[0]?.id ?? "");
  const [announcement, setAnnouncement] = useState("Selecciona un extremo para empezar.");

  const activePair = question.pairs.find((pair) => pair.id === activePairId) ?? question.pairs[0];
  const answer = useMemo(() => ({ paths }), [paths]);
  const metrics = useMemo(() => calculateConnectPairsMetrics(question, answer), [answer, question]);

  useEffect(() => {
    boardRef.current?.focus();
  }, []);

  const publishPaths = (nextPaths: Record<string, number[]>, message: string) => {
    const nextAnswer = { paths: nextPaths };
    const nextMetrics = calculateConnectPairsMetrics(question, nextAnswer);
    setPaths(nextPaths);
    onProgress(nextAnswer);
    setAnnouncement(message);
    if (!locked && nextMetrics.exact) onSubmit(nextAnswer);
  };

  const startPairAt = (pair: ConnectPairsPair, cell: number) => {
    setActivePairId(pair.id);
    const existingPath = paths[pair.id] ?? [];
    const existingIndex = existingPath.indexOf(cell);
    if (existingIndex >= 0) {
      publishPaths(
        { ...paths, [pair.id]: existingPath.slice(0, existingIndex + 1) },
        `${pair.label}: ruta recortada hasta la casilla ${cell + 1}.`,
      );
      return;
    }
    publishPaths({ ...paths, [pair.id]: [cell] }, `${pair.label}: ruta iniciada.`);
  };

  const extendActivePath = (cell: number) => {
    if (!activePair) return;
    const currentPath = paths[activePair.id] ?? [];
    if (currentPath.length === 0) {
      if (activePair.endpoints.includes(cell)) startPairAt(activePair, cell);
      return;
    }

    const existingIndex = currentPath.indexOf(cell);
    if (existingIndex >= 0) {
      publishPaths(
        { ...paths, [activePair.id]: currentPath.slice(0, existingIndex + 1) },
        `${activePair.label}: ruta recortada hasta la casilla ${cell + 1}.`,
      );
      return;
    }

    const lastCell = currentPath.at(-1);
    if (lastCell === undefined || !areNeighbors(lastCell, cell)) {
      setAnnouncement("Solo puedes avanzar a una casilla ortogonal adyacente.");
      return;
    }

    const occupiedByOtherPair = question.pairs.some(
      (pair) => pair.id !== activePair.id && (paths[pair.id] ?? []).includes(cell),
    );
    if (occupiedByOtherPair) {
      setAnnouncement("Esa casilla ya pertenece a otra ruta.");
      return;
    }

    const otherEndpoint = question.pairs.some(
      (pair) => pair.id !== activePair.id && pair.endpoints.includes(cell),
    );
    if (otherEndpoint) {
      setAnnouncement("No puedes usar el extremo de otra pareja.");
      return;
    }

    publishPaths(
      { ...paths, [activePair.id]: [...currentPath, cell] },
      `${activePair.label}: ruta extendida a la casilla ${cell + 1}.`,
    );
  };

  const handleCell = (cell: number) => {
    if (locked) return;
    const result = applyConnectPairsCellSelection(question, paths, activePairId, cell);
    setActivePairId(result.activePairId);
    if (result.changed) {
      publishPaths(result.paths, result.message);
      return;
    }
    setAnnouncement(result.message);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (locked || !activePair) return;
    const nextCell = neighborForKey(
      (paths[activePair.id] ?? []).at(-1) ?? activePair.endpoints[0],
      event.key,
    );
    if (nextCell === null) return;
    event.preventDefault();
    extendActivePath(nextCell);
  };

  const clearActivePath = () => {
    if (!activePair || locked) return;
    const nextPaths = { ...paths };
    delete nextPaths[activePair.id];
    publishPaths(nextPaths, `${activePair.label}: ruta borrada.`);
  };

  const cellOwners = new Map<number, CellOwner>();
  question.pairs.forEach((pair, index) => {
    const color = pair.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
    pair.endpoints.forEach((endpoint) =>
      cellOwners.set(endpoint, {
        pair: { ...pair, color },
        isEndpoint: true,
      }),
    );
    (paths[pair.id] ?? []).forEach((cell) => {
      const owner = cellOwners.get(cell) ?? {
        pair: { ...pair, color },
        isEndpoint: pair.endpoints.includes(cell),
      };
      cellOwners.set(cell, owner);
    });
  });

  return (
    <section className={styles.root} aria-label="Conectar parejas">
      <div className={styles.header}>
        <span>Conecta sin cruzar rutas</span>
        <strong>
          {metrics.connectedPairs}/{metrics.totalPairs} · {Math.round(metrics.coverageRatio * 100)}{" "}
          %
        </strong>
      </div>

      <div className={styles.legend} aria-label="Parejas disponibles">
        {question.pairs.map((pair, index) => {
          const color = pair.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
          return (
            <button
              key={pair.id}
              type="button"
              className={`${styles.legendButton} ${pair.id === activePairId ? styles.legendActive : ""}`}
              style={{ "--pair-color": color } as CSSProperties}
              disabled={locked}
              onClick={() => {
                setActivePairId(pair.id);
                setAnnouncement(`${pair.label} seleccionada.`);
                boardRef.current?.focus();
              }}
            >
              <span aria-hidden="true">{pair.symbol}</span>
              {pair.label}
            </button>
          );
        })}
      </div>

      <div
        ref={boardRef}
        className={styles.board}
        style={{ gridTemplateColumns: `repeat(${CONNECT_PAIRS_COLUMNS}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Tablero de Conectar parejas. Usa las flechas para extender la ruta activa."
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <svg
          className={styles.routeOverlay}
          viewBox={`0 0 ${CONNECT_PAIRS_COLUMNS} ${CONNECT_PAIRS_ROWS}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {question.pairs.map((pair, index) => {
            const path = paths[pair.id] ?? [];
            if (path.length < 2) return null;
            const color = pair.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
            return (
              <polyline
                key={pair.id}
                className={styles.routeLine}
                points={routePoints(path)}
                style={{ "--pair-color": color } as CSSProperties}
              />
            );
          })}
        </svg>

        {Array.from({ length: CONNECT_PAIRS_ROWS * CONNECT_PAIRS_COLUMNS }, (_, cell) => {
          const owner = cellOwners.get(cell);
          const active = owner?.pair.id === activePairId;
          const row = Math.floor(cell / CONNECT_PAIRS_COLUMNS) + 1;
          const column = (cell % CONNECT_PAIRS_COLUMNS) + 1;
          return (
            <div
              key={cell}
              className={`${styles.cell} ${owner ? styles.route : styles.empty} ${
                owner?.isEndpoint ? styles.endpoint : ""
              } ${active ? styles.active : ""}`}
              role="gridcell"
            >
              <button
                type="button"
                className={styles.cellButton}
                style={{ "--pair-color": owner?.pair.color ?? "transparent" } as CSSProperties}
                disabled={locked}
                onClick={() => handleCell(cell)}
                aria-label={`Fila ${row}, columna ${column}${
                  owner
                    ? `: ${owner.isEndpoint ? "extremo" : "ruta"} de ${owner.pair.label}`
                    : ": vacía"
                }`}
              >
                {owner?.isEndpoint && <span className={styles.symbol}>{owner.pair.symbol}</span>}
              </button>
            </div>
          );
        })}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          disabled={locked || !activePair || !paths[activePair.id]?.length}
          onClick={clearActivePath}
        >
          Borrar ruta
        </button>
        <button
          type="button"
          disabled={locked || !hasProgress(paths)}
          onClick={() => {
            if (metrics.coveredCells > 0 && metrics.connectedPairs === 0) {
              setAnnouncement(
                "Aún no hay parejas conectadas. Toca el extremo final de cada ruta para cerrarla.",
              );
              return;
            }
            onSubmit(answer);
          }}
        >
          Enviar
        </button>
      </div>

      <p className={styles.instructions}>
        Selecciona un extremo y avanza por celdas contiguas hasta tocar el otro extremo de la misma
        pareja. Cada ruta usa su propio símbolo además del color.
      </p>
      <p className={styles.statusText} role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
