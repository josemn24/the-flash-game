"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyConnectPairsCellSelection,
  calculateConnectPairsMetrics,
  CONNECT_PAIRS_COLUMNS,
  CONNECT_PAIRS_ROWS,
  isRestorableConnectPairsDraft,
  startConnectPairsDrag,
} from "@/lib/connectPairs";
import type {
  ConnectPairsAnswer,
  ConnectPairsPair,
  ConnectPairsQuestion as Question,
  QuestionVariant,
} from "@/types/game";
import styles from "./ConnectPairsQuestion.module.css";

const DEFAULT_COLORS = ["#35e8ff", "#d7ff18", "#ff6d73", "#43deb7", "#b994ff"];

type CellOwner = {
  pair: ConnectPairsPair;
  isEndpoint: boolean;
};

type Point = { x: number; y: number };

type DragState = {
  pointerId: number;
  startCell: number;
  startPoint: Point;
  lastPoint: Point;
  lastCell: number;
  canDrag: boolean;
  moved: boolean;
};

const DRAG_THRESHOLD = 6;

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
  variant,
}: {
  question: Question;
  initialAnswer?: ConnectPairsAnswer;
  locked: boolean;
  onProgress: (answer: ConnectPairsAnswer) => void;
  onSubmit: (answer: ConnectPairsAnswer) => void;
  variant?: QuestionVariant;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<Record<string, number[]>>(() =>
    isRestorableConnectPairsDraft(question, initialAnswer)
      ? Object.fromEntries(
          Object.entries(initialAnswer.paths).map(([pairId, path]) => [pairId, [...path]]),
        )
      : {},
  );
  const pathsRef = useRef(paths);
  const [activePairId, setActivePairId] = useState(question.pairs[0]?.id ?? "");
  const activePairIdRef = useRef(activePairId);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [announcement, setAnnouncement] = useState("Selecciona un extremo para empezar.");

  const activePair = question.pairs.find((pair) => pair.id === activePairId) ?? question.pairs[0];
  const answer = useMemo(() => ({ paths }), [paths]);
  const metrics = useMemo(() => calculateConnectPairsMetrics(question, answer), [answer, question]);

  useEffect(() => {
    boardRef.current?.focus();
  }, []);

  const setActivePair = (pairId: string) => {
    activePairIdRef.current = pairId;
    setActivePairId(pairId);
  };

  const publishPaths = (nextPaths: Record<string, number[]>, message: string) => {
    const nextAnswer = { paths: nextPaths };
    const nextMetrics = calculateConnectPairsMetrics(question, nextAnswer);
    pathsRef.current = nextPaths;
    setPaths(nextPaths);
    onProgress(nextAnswer);
    setAnnouncement(message);
    if (!locked && nextMetrics.exact) onSubmit(nextAnswer);
  };

  const startPairAt = (pair: ConnectPairsPair, cell: number) => {
    setActivePair(pair.id);
    const existingPath = pathsRef.current[pair.id] ?? [];
    const existingIndex = existingPath.indexOf(cell);
    if (existingIndex >= 0) {
      publishPaths(
        { ...pathsRef.current, [pair.id]: existingPath.slice(0, existingIndex + 1) },
        `${pair.label}: ruta recortada hasta la casilla ${cell + 1}.`,
      );
      return;
    }
    publishPaths({ ...pathsRef.current, [pair.id]: [cell] }, `${pair.label}: ruta iniciada.`);
  };

  const extendActivePath = (cell: number) => {
    const currentActivePairId = activePairIdRef.current;
    const currentActivePair =
      question.pairs.find((pair) => pair.id === currentActivePairId) ?? question.pairs[0];
    if (!currentActivePair) return;
    const currentPaths = pathsRef.current;
    const currentPath = currentPaths[currentActivePair.id] ?? [];
    if (currentPath.length === 0) {
      if (currentActivePair.endpoints.includes(cell)) startPairAt(currentActivePair, cell);
      return;
    }

    const existingIndex = currentPath.indexOf(cell);
    if (existingIndex >= 0) {
      publishPaths(
        { ...currentPaths, [currentActivePair.id]: currentPath.slice(0, existingIndex + 1) },
        `${currentActivePair.label}: ruta recortada hasta la casilla ${cell + 1}.`,
      );
      return;
    }

    const lastCell = currentPath.at(-1);
    if (lastCell === undefined || !areNeighbors(lastCell, cell)) {
      setAnnouncement("Solo puedes avanzar a una casilla ortogonal adyacente.");
      return;
    }

    const occupiedByOtherPair = question.pairs.some(
      (pair) => pair.id !== currentActivePair.id && (currentPaths[pair.id] ?? []).includes(cell),
    );
    if (occupiedByOtherPair) {
      setAnnouncement("Esa casilla ya pertenece a otra ruta.");
      return;
    }

    const otherEndpoint = question.pairs.some(
      (pair) => pair.id !== currentActivePair.id && pair.endpoints.includes(cell),
    );
    if (otherEndpoint) {
      setAnnouncement("No puedes usar el extremo de otra pareja.");
      return;
    }

    publishPaths(
      { ...currentPaths, [currentActivePair.id]: [...currentPath, cell] },
      `${currentActivePair.label}: ruta extendida a la casilla ${cell + 1}.`,
    );
  };

  const handleCell = (cell: number) => {
    if (locked) return;
    const result = applyConnectPairsCellSelection(
      question,
      pathsRef.current,
      activePairIdRef.current,
      cell,
    );
    setActivePair(result.activePairId);
    if (result.changed) {
      publishPaths(result.paths, result.message);
      return;
    }
    setAnnouncement(result.message);
  };

  const cellAtPoint = (point: Point) => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    if (
      point.x < rect.left ||
      point.x >= rect.right ||
      point.y < rect.top ||
      point.y >= rect.bottom
    ) {
      return null;
    }
    const column = Math.floor(((point.x - rect.left) / rect.width) * CONNECT_PAIRS_COLUMNS);
    const row = Math.floor(((point.y - rect.top) / rect.height) * CONNECT_PAIRS_ROWS);
    return row * CONNECT_PAIRS_COLUMNS + column;
  };

  const tracePointerSegment = (from: Point, to: Point) => {
    const board = boardRef.current;
    const drag = dragRef.current;
    if (!board || !drag) return;
    const rect = board.getBoundingClientRect();
    const sampleDistance =
      Math.min(rect.width / CONNECT_PAIRS_COLUMNS, rect.height / CONNECT_PAIRS_ROWS) / 2;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / sampleDistance));
    let previousCell = drag.lastCell;
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      const cell = cellAtPoint({
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      });
      if (cell !== null && cell !== previousCell) {
        extendActivePath(cell);
        previousCell = cell;
      }
    }
    drag.lastCell = previousCell;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (locked || !event.isPrimary || event.button !== 0) return;
    const point = { x: event.clientX, y: event.clientY };
    const cell = cellAtPoint(point);
    if (cell === null) return;
    const canDrag = question.pairs.some((pair) => pair.endpoints.includes(cell));
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startCell: cell,
      startPoint: point,
      lastPoint: point,
      lastCell: cell,
      canDrag,
      moved: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !drag.canDrag) return;
    const point = { x: event.clientX, y: event.clientY };
    if (!drag.moved) {
      if (Math.hypot(point.x - drag.startPoint.x, point.y - drag.startPoint.y) <= DRAG_THRESHOLD) {
        return;
      }
      const result = startConnectPairsDrag(
        question,
        pathsRef.current,
        drag.startCell,
        activePairIdRef.current,
      );
      if (!result.changed) return;
      drag.moved = true;
      suppressClickRef.current = true;
      setActivePair(result.activePairId);
      publishPaths(result.paths, result.message);
    }
    event.preventDefault();
    tracePointerSegment(drag.lastPoint, point);
    drag.lastPoint = point;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    if (cancelled) {
      suppressClickRef.current = false;
    } else if (drag.moved) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    boardRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentActivePair =
      question.pairs.find((pair) => pair.id === activePairIdRef.current) ?? question.pairs[0];
    if (locked || !currentActivePair) return;
    const currentPath = pathsRef.current[currentActivePair.id] ?? [];
    const currentCell = currentPath.at(-1);
    if (currentCell === undefined) return;
    const nextCell = neighborForKey(currentCell, event.key);
    if (nextCell === null) return;
    event.preventDefault();
    extendActivePath(nextCell);
  };

  const clearActivePath = () => {
    const currentActivePair =
      question.pairs.find((pair) => pair.id === activePairIdRef.current) ?? question.pairs[0];
    if (!currentActivePair || locked) return;
    const nextPaths = { ...pathsRef.current };
    delete nextPaths[currentActivePair.id];
    publishPaths(nextPaths, `${currentActivePair.label}: ruta borrada.`);
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
    <section
      className={`${styles.root}`}
      aria-label="Conectar parejas"
      data-variant={variant ?? "default"}
    >
      <div className={styles.header}>
        <span>Conecta sin cruzar rutas</span>
        <strong>
          {metrics.connectedPairs}/{metrics.totalPairs} · {Math.round(metrics.coverageRatio * 100)}{" "}
          %
        </strong>
      </div>

      <div
        ref={boardRef}
        className={styles.board}
        style={{ gridTemplateColumns: `repeat(${CONNECT_PAIRS_COLUMNS}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Tablero de Conectar parejas. Arrastra desde un extremo hasta su pareja o usa las flechas."
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={(event) => handlePointerUp(event, true)}
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
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  handleCell(cell);
                }}
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
        Arrastra desde un símbolo hasta su pareja. No cruces ni compartas celdas; también puedes
        usar clics o las flechas del teclado.
      </p>
      <p className={styles.statusText} role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
