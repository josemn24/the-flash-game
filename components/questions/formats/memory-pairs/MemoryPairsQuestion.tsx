"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, CrossIcon } from "@/components/ui";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import styles from "./MemoryPairsQuestion.module.css";
import type { MemoryPairsAnswer, MemoryPairsTile, QuestionVariant } from "@/types/game";

type MemoryPairsQuestionProps = {
  grid: { rows: number; columns: number };
  tiles: MemoryPairsTile[];
  mismatchRevealDuration?: number;
  locked: boolean;
  onProgress: (answer: MemoryPairsAnswer) => void;
  onSubmit: (answer: MemoryPairsAnswer) => void;
  variant?: QuestionVariant;
};

type VisibleMismatch = [string, string] | null;

function tileLabel(tile: MemoryPairsTile | undefined) {
  return tile?.label ?? "Loseta desconocida";
}

export function MemoryPairsQuestion({
  grid,
  tiles,
  mismatchRevealDuration = 0.65,
  locked,
  onProgress,
  onSubmit,
  variant,
}: MemoryPairsQuestionProps) {
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(() => new Set());
  const [attempts, setAttempts] = useState<MemoryPairsAnswer["attempts"]>([]);
  const [visibleMismatch, setVisibleMismatch] = useState<VisibleMismatch>(null);
  const [announcement, setAnnouncement] = useState("Descubre dos losetas para buscar una pareja.");
  const tileById = useMemo(() => new Map(tiles.map((tile) => [tile.id, tile])), [tiles]);
  const totalPairs = useMemo(() => new Set(tiles.map((tile) => tile.pairId)).size, [tiles]);
  const completed = matchedPairIds.size === totalPairs;

  useEffect(
    () => () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    },
    [],
  );

  const submitAttempt = (firstId: string, secondId: string) => {
    const firstTile = tileById.get(firstId);
    const secondTile = tileById.get(secondId);
    if (!firstTile || !secondTile || firstId === secondId) return;

    const nextAttempts: MemoryPairsAnswer["attempts"] = [...attempts, [firstId, secondId]];
    setAttempts(nextAttempts);
    onProgress({ attempts: nextAttempts });
    setSelectedTileId(null);

    if (firstTile.pairId === secondTile.pairId) {
      const nextMatchedPairIds = new Set(matchedPairIds);
      nextMatchedPairIds.add(firstTile.pairId);
      setMatchedPairIds(nextMatchedPairIds);
      setAnnouncement(`Pareja encontrada: ${firstTile.label}.`);
      if (nextMatchedPairIds.size === totalPairs) onSubmit({ attempts: nextAttempts });
      return;
    }

    setVisibleMismatch([firstId, secondId]);
    setAnnouncement(`${firstTile.label} y ${secondTile.label} no forman pareja.`);
    resetTimeoutRef.current = setTimeout(
      () => setVisibleMismatch(null),
      Math.max(0.1, mismatchRevealDuration) * 1000,
    );
  };

  const chooseTile = (tileId: string) => {
    const tile = tileById.get(tileId);
    if (!tile || locked || completed || visibleMismatch || matchedPairIds.has(tile.pairId)) return;
    if (!selectedTileId) {
      setSelectedTileId(tileId);
      setAnnouncement(`Loseta revelada: ${tile.label}. Elige otra loseta.`);
      return;
    }
    if (selectedTileId === tileId) {
      setSelectedTileId(null);
      setAnnouncement("Loseta ocultada.");
      return;
    }
    submitAttempt(selectedTileId, tileId);
  };

  return (
    <section
      className={styles.root}
      data-variant={variant ?? "default"}
      aria-label="Memoria de parejas"
    >
      <div className={styles.header}>
        <span>Encuentra las parejas</span>
        <strong>
          {matchedPairIds.size} de {totalPairs}
        </strong>
      </div>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))` }}
      >
        {tiles.map((tile, index) => {
          const matched = matchedPairIds.has(tile.pairId);
          const selected = selectedTileId === tile.id;
          const mismatched = Boolean(visibleMismatch?.includes(tile.id));
          const revealed = matched || selected || mismatched;
          const hasVisual = Boolean(tile.media || tile.symbol);
          return (
            <button
              key={tile.id}
              type="button"
              className={`${styles.tile} ${revealed ? styles.tileRevealed : ""} ${
                matched ? styles.tileMatched : ""
              } ${mismatched ? styles.tileMismatched : ""}`}
              disabled={locked || completed || matched || Boolean(visibleMismatch)}
              aria-pressed={revealed}
              aria-label={
                revealed
                  ? `Loseta ${index + 1}: ${tile.label}${
                      matched ? ", pareja encontrada" : mismatched ? ", intento fallido" : ""
                    }`
                  : `Loseta ${index + 1}: oculta`
              }
              onClick={() => chooseTile(tile.id)}
            >
              {revealed ? (
                <span className={styles.tileFace}>
                  {tile.media && <QuestionMedia media={tile.media} compact />}
                  {tile.symbol && (
                    <span className={styles.tileSymbol} aria-hidden="true">
                      {tile.symbol}
                    </span>
                  )}
                  {!hasVisual && <strong>{tile.label}</strong>}
                  {matched && <CheckIcon className={styles.stateIcon} />}
                  {mismatched && <CrossIcon className={styles.stateIcon} />}
                </span>
              ) : (
                <span className={styles.tileBack} aria-hidden="true">
                  ?
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className={styles.meta} aria-hidden="true">
        <span>{attempts.length} intentos</span>
        <span>
          {
            attempts.filter(
              ([firstId, secondId]) =>
                tileById.get(firstId)?.pairId !== tileById.get(secondId)?.pairId,
            ).length
          }{" "}
          fallos
        </span>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <p className="sr-only">
        {visibleMismatch
          ? `${tileLabel(tileById.get(visibleMismatch[0]))} y ${tileLabel(
              tileById.get(visibleMismatch[1]),
            )} se ocultarán tras la pausa.`
          : ""}
      </p>
    </section>
  );
}
