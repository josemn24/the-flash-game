import type { GameMode } from "@/types/domain/content";

export function isGameMode(value: unknown): value is GameMode {
  return (
    value === "flash" ||
    value === "alphabet" ||
    value === "survival" ||
    value === "pyramid" ||
    value === "narrative"
  );
}

export function readCompetitiveProjection(
  value: unknown,
): { mode: GameMode; rows: unknown[] } | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid competitive challenge envelope");
  }
  const envelope = value as Record<string, unknown>;
  if (!isGameMode(envelope.mode) || !Array.isArray(envelope.rows) || !envelope.rows.length) {
    throw new Error("Invalid competitive challenge envelope");
  }
  for (const row of envelope.rows) {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      (row as Record<string, unknown>).challenge_mode !== envelope.mode
    ) {
      throw new Error("Inconsistent competitive challenge mode");
    }
  }
  return { mode: envelope.mode, rows: envelope.rows };
}

export function validateCompetitiveRows<T>(
  rows: readonly unknown[],
  guard: (value: unknown) => value is T,
): T[] {
  if (!rows.every(guard)) throw new Error("Invalid competitive challenge rows");
  return rows.filter(guard);
}
