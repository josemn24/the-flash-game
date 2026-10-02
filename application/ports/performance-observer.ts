import type { GameMode } from "@/types/domain/content";

export type PerformancePhase =
  | "attempt.context"
  | "attempt.receive"
  | "attempt.evaluation-context"
  | "attempt.assets"
  | "attempt.scoring"
  | "attempt.record"
  | "attempt.pass"
  | "attempt.finish"
  | "challenge.initial"
  | "challenge.enrichment"
  | "pool.wait";

/** Optional diagnostics capability; never receives gameplay payloads or secrets. */
export interface PerformanceObserver {
  measure<T>(phase: PerformancePhase, work: () => T | Promise<T>): Promise<T>;
  setMode(mode: GameMode): void;
}

export function observePerformance<T>(
  observer: PerformanceObserver | undefined,
  phase: PerformancePhase,
  work: () => T | Promise<T>,
): Promise<T> {
  return observer ? observer.measure(phase, work) : Promise.resolve(work());
}
