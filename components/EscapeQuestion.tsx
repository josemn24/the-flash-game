"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { UndoIcon, RotateIcon } from "@/components/icons";
import {
  applyEscapeMove,
  getEscapeLegalDestinations,
  isEscapeSolved,
  replayEscapeMoves,
} from "@/lib/escape";
import type {
  EscapeAnswer,
  EscapeBlock,
  EscapeMove,
  EscapeQuestion as EscapeQuestionType,
} from "@/types/game";
import styles from "@/components/EscapeQuestion.module.css";

type DragState = {
  pointerId: number;
  blockId: string;
  startClient: number;
  startPosition: number;
  cellSize: number;
  legalDestinations: number[];
  currentDestination: number;
};

type DragVisual = { blockId: string; offset: number; destination: number } | null;

function blockStart(block: EscapeBlock) {
  return block.orientation === "horizontal" ? block.column : block.row;
}

function blockStyle(question: EscapeQuestionType, block: EscapeBlock): CSSProperties {
  const cellWidth = 100 / question.grid.columns;
  const cellHeight = 100 / question.grid.rows;
  return {
    left: `calc(${block.column * cellWidth}% + 3px)`,
    top: `calc(${block.row * cellHeight}% + 3px)`,
    width: `calc(${(block.orientation === "horizontal" ? block.length : 1) * cellWidth}% - 6px)`,
    height: `calc(${(block.orientation === "vertical" ? block.length : 1) * cellHeight}% - 6px)`,
  };
}

function boardStyle(question: EscapeQuestionType) {
  return {
    "--escape-exit-top": `${question.grid.exit.row * (100 / question.grid.rows)}%`,
  } as CSSProperties;
}

function blockLabel(block: EscapeBlock, symbol: string) {
  const end = blockStart(block) + block.length - 1;
  return block.kind === "target"
    ? `Bloque objetivo, horizontal, fila ${block.row + 1}, columnas ${block.column + 1} a ${block.column + block.length}`
    : `Bloque ${symbol}, ${block.orientation === "horizontal" ? "horizontal" : "vertical"}, ${
        block.orientation === "horizontal"
          ? `fila ${block.row + 1}, columnas ${block.column + 1} a ${end + 1}`
          : `columna ${block.column + 1}, filas ${block.row + 1} a ${end + 1}`
      }`;
}

function blockSymbols(question: EscapeQuestionType) {
  let obstacleIndex = 0;
  return Object.fromEntries(
    question.initialBlocks.map((block) => [
      block.id,
      block.kind === "target" ? "→" : String.fromCharCode(65 + obstacleIndex++),
    ]),
  );
}

export function EscapeBoard({
  question,
  blocks,
  label,
  animateEscape = false,
}: {
  question: EscapeQuestionType;
  blocks: EscapeBlock[];
  label: string;
  animateEscape?: boolean;
}) {
  const symbols = useMemo(() => blockSymbols(question), [question]);
  return (
    <div className={styles.boardShell}>
      <div
        className={`${styles.board} ${styles.reviewBoard}`}
        style={boardStyle(question)}
        role="img"
        aria-label={label}
      >
        <span className={styles.exit} style={{ top: `${question.grid.exit.row * (100 / 6)}%` }}>
          →
        </span>
        {blocks.map((block, index) => (
          <span
            key={block.id}
            className={`${styles.block} ${
              block.kind === "target" ? styles.target : styles.obstacle
            } ${styles[`pattern${index % 4}`]} ${
              animateEscape && block.kind === "target" ? styles.escaping : ""
            }`}
            style={blockStyle(question, block)}
            aria-hidden="true"
          >
            {symbols[block.id]}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EscapeQuestion({
  question,
  locked,
  onProgress,
  onSubmit,
}: {
  question: EscapeQuestionType;
  locked: boolean;
  onProgress: (answer: EscapeAnswer) => void;
  onSubmit: (answer: EscapeAnswer) => void;
}) {
  const symbols = useMemo(() => blockSymbols(question), [question]);
  const boardRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef(question.initialBlocks.map((block) => ({ ...block })));
  const movesRef = useRef<EscapeMove[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const [blocks, setBlocks] = useState(() => question.initialBlocks.map((block) => ({ ...block })));
  const [moves, setMoves] = useState<EscapeMove[]>([]);
  const [selectedId, setSelectedId] = useState(question.initialBlocks[0]?.id ?? "");
  const [dragVisual, setDragVisual] = useState<DragVisual>(null);
  const [completed, setCompleted] = useState(false);
  const [announcement, setAnnouncement] = useState(
    "Selecciona un bloque y muévelo sobre su eje. Con teclado, usa las flechas compatibles.",
  );

  const selectedBlock = blocks.find((block) => block.id === selectedId);
  const selectedDestinations = selectedBlock
    ? getEscapeLegalDestinations(question, blocks, selectedId)
    : [];

  const publishMove = (move: EscapeMove) => {
    if (locked || completed) return;
    const nextBlocks = applyEscapeMove(question, blocksRef.current, move);
    if (!nextBlocks) {
      setAnnouncement("Ese movimiento está bloqueado.");
      return;
    }

    const nextMoves = [...movesRef.current, move];
    blocksRef.current = nextBlocks;
    movesRef.current = nextMoves;
    setBlocks(nextBlocks);
    setMoves(nextMoves);
    const answer = { moves: nextMoves };
    onProgress(answer);
    const symbol = symbols[move.blockId];
    const escaped = isEscapeSolved(question, nextBlocks);
    setAnnouncement(
      escaped
        ? "Salida despejada. El bloque objetivo ha escapado."
        : `Bloque ${symbol} movido a la posición ${move.to + 1}.`,
    );
    if (escaped) {
      setCompleted(true);
      onSubmit(answer);
    }
  };

  const selectBlock = (block: EscapeBlock) => {
    if (locked || completed) return;
    setSelectedId(block.id);
    const destinations = getEscapeLegalDestinations(question, blocksRef.current, block.id);
    setAnnouncement(
      destinations.length
        ? `${blockLabel(block, symbols[block.id])}. ${destinations.length} destinos disponibles.`
        : `${blockLabel(block, symbols[block.id])}. No puede moverse ahora.`,
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, block: EscapeBlock) => {
    const negativeKey = block.orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const positiveKey = block.orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
    if (event.key !== negativeKey && event.key !== positiveKey) return;
    event.preventDefault();
    selectBlock(block);
    const current = blockStart(block);
    const destinations = getEscapeLegalDestinations(question, blocksRef.current, block.id).filter(
      (destination) => (event.key === negativeKey ? destination < current : destination > current),
    );
    if (!destinations.length) {
      setAnnouncement("No hay espacio libre en esa dirección.");
      return;
    }
    const destination =
      event.key === negativeKey ? Math.max(...destinations) : Math.min(...destinations);
    publishMove({ blockId: block.id, from: current, to: destination });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, block: EscapeBlock) => {
    if (locked || completed || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectBlock(block);
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    dragRef.current = {
      pointerId: event.pointerId,
      blockId: block.id,
      startClient: block.orientation === "horizontal" ? event.clientX : event.clientY,
      startPosition: blockStart(block),
      cellSize:
        block.orientation === "horizontal"
          ? boardRect.width / question.grid.columns
          : boardRect.height / question.grid.rows,
      legalDestinations: getEscapeLegalDestinations(question, blocksRef.current, block.id),
      currentDestination: blockStart(block),
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>, block: EscapeBlock) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.blockId !== block.id) return;
    event.preventDefault();
    const currentClient = block.orientation === "horizontal" ? event.clientX : event.clientY;
    const rawPosition = drag.startPosition + (currentClient - drag.startClient) / drag.cellSize;
    const allowed = [drag.startPosition, ...drag.legalDestinations];
    const minimum = Math.min(...allowed);
    const maximum = Math.max(...allowed);
    const clampedPosition = Math.min(maximum, Math.max(minimum, rawPosition));
    const destination = allowed.reduce((nearest, candidate) =>
      Math.abs(candidate - clampedPosition) < Math.abs(nearest - clampedPosition)
        ? candidate
        : nearest,
    );
    drag.currentDestination = destination;
    setDragVisual({
      blockId: block.id,
      offset: (clampedPosition - drag.startPosition) * drag.cellSize,
      destination,
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const destination = drag.currentDestination;
    dragRef.current = null;
    setDragVisual(null);
    if (destination !== drag.startPosition) {
      publishMove({ blockId: drag.blockId, from: drag.startPosition, to: destination });
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragVisual(null);
    setAnnouncement("Movimiento cancelado.");
  };

  const undo = () => {
    if (locked || completed || movesRef.current.length === 0) return;
    const nextMoves = movesRef.current.slice(0, -1);
    const replay = replayEscapeMoves(question, nextMoves);
    blocksRef.current = replay.blocks;
    movesRef.current = nextMoves;
    setBlocks(replay.blocks);
    setMoves(nextMoves);
    onProgress({ moves: nextMoves });
    setAnnouncement("Se ha deshecho el último movimiento.");
  };

  const reset = () => {
    if (locked || completed || movesRef.current.length === 0) return;
    const initialBlocks = question.initialBlocks.map((block) => ({ ...block }));
    blocksRef.current = initialBlocks;
    movesRef.current = [];
    setBlocks(initialBlocks);
    setMoves([]);
    setSelectedId(initialBlocks[0]?.id ?? "");
    onProgress({ moves: [] });
    setAnnouncement("Tablero reiniciado.");
  };

  return (
    <section className={styles.root} aria-label="Escape, puzzle de bloques deslizantes">
      <div className={styles.header}>
        <span>Saca el bloque amarillo</span>
        <strong>
          {moves.length} {moves.length === 1 ? "movimiento" : "movimientos"}
        </strong>
      </div>
      <div className={styles.boardShell}>
        <div
          ref={boardRef}
          className={styles.board}
          style={boardStyle(question)}
          role="group"
          aria-label="Tablero Escape de seis por seis"
        >
          <span
            className={styles.exit}
            style={{ top: `${question.grid.exit.row * (100 / 6)}%` }}
            aria-hidden="true"
          >
            →
          </span>
          {selectedBlock &&
            selectedDestinations.map((destination) => {
              const ghost = {
                ...selectedBlock,
                ...(selectedBlock.orientation === "horizontal"
                  ? { column: destination }
                  : { row: destination }),
              };
              return (
                <span
                  key={destination}
                  className={styles.destinationGhost}
                  style={blockStyle(question, ghost)}
                  aria-hidden="true"
                />
              );
            })}
          {blocks.map((block, index) => {
            const dragging = dragVisual?.blockId === block.id;
            return (
              <button
                key={block.id}
                type="button"
                className={`${styles.block} ${
                  block.kind === "target" ? styles.target : styles.obstacle
                } ${styles[`pattern${index % 4}`]} ${selectedId === block.id ? styles.selected : ""}`}
                style={{
                  ...blockStyle(question, block),
                  transform: dragging
                    ? block.orientation === "horizontal"
                      ? `translateX(${dragVisual.offset}px)`
                      : `translateY(${dragVisual.offset}px)`
                    : undefined,
                }}
                disabled={locked || completed}
                aria-pressed={selectedId === block.id}
                aria-keyshortcuts={
                  block.orientation === "horizontal" ? "ArrowLeft ArrowRight" : "ArrowUp ArrowDown"
                }
                aria-label={`${blockLabel(block, symbols[block.id])}${
                  selectedId === block.id ? ", seleccionado" : ""
                }`}
                onClick={() => selectBlock(block)}
                onKeyDown={(event) => handleKeyDown(event, block)}
                onPointerDown={(event) => handlePointerDown(event, block)}
                onPointerMove={(event) => handlePointerMove(event, block)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
              >
                {symbols[block.id]}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={undo} disabled={locked || completed || moves.length === 0}>
          <UndoIcon /> Deshacer
        </button>
        <button type="button" onClick={reset} disabled={locked || completed || moves.length === 0}>
          <RotateIcon /> Reiniciar
        </button>
      </div>
      <p className={styles.instructions}>
        Arrastra los bloques sobre su eje para despejar la salida.
      </p>
      <p className={styles.srStatus} aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
