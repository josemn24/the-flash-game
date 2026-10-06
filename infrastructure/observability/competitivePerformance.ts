import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type {
  PerformanceObserver,
  PerformancePhase,
} from "@/application/ports/performance-observer";
import type { GameMode } from "@/types/domain/content";

type Measurements = {
  operationId: string;
  operation: string;
  requestId?: string;
  mode?: GameMode;
  phases: Partial<Record<PerformancePhase, number>>;
  transactions: number;
  sqlQueries: number;
  rpcCalls: number;
  recoveryEvents: Partial<
    Record<Parameters<NonNullable<PerformanceObserver["recordRecovery"]>>[0], number>
  >;
};
const operations = new AsyncLocalStorage<Measurements>();
const activePhases = new AsyncLocalStorage<readonly PerformancePhase[]>();

export const competitivePerformanceObserver: PerformanceObserver = {
  async measure(phase, work) {
    const collector = operations.getStore();
    const parents = activePhases.getStore() ?? [];
    if (!collector || parents.includes(phase)) return work();
    const started = performance.now();
    return activePhases.run([...parents, phase], async () => {
      try {
        return await work();
      } finally {
        collector.phases[phase] = (collector.phases[phase] ?? 0) + performance.now() - started;
      }
    });
  },
  setMode(mode) {
    const collector = operations.getStore();
    if (collector) collector.mode = mode;
  },
  recordRecovery(event) {
    const collector = operations.getStore();
    if (collector) collector.recoveryEvents[event] = (collector.recoveryEvents[event] ?? 0) + 1;
  },
};

export function countCompetitiveDatabaseCall(kind: "transactions" | "sqlQueries" | "rpcCalls") {
  const collector = operations.getStore();
  if (collector) collector[kind] += 1;
}

export async function observeCompetitiveOperation<T>(
  operation: string,
  work: () => T | Promise<T>,
  requestId?: string,
): Promise<T> {
  if (process.env.FLASH_PERFORMANCE_DIAGNOSTICS !== "1") return work();
  const collector: Measurements = {
    operationId: randomUUID(),
    operation,
    ...(requestId ? { requestId } : {}),
    phases: {},
    transactions: 0,
    sqlQueries: 0,
    rpcCalls: 0,
    recoveryEvents: {},
  };
  return operations.run(collector, async () => {
    const started = performance.now();
    let result: "ok" | "error" = "error";
    try {
      const value = await work();
      result = "ok";
      return value;
    } finally {
      // Explicit projection: errors, SQL, tokens, answers and asset URLs never enter this log.
      console.info(
        JSON.stringify({
          event: "competitive_performance",
          operationId: collector.operationId,
          operation: collector.operation,
          ...(collector.requestId ? { requestId: collector.requestId } : {}),
          ...(collector.mode ? { mode: collector.mode } : {}),
          durationMs: performance.now() - started,
          phases: collector.phases,
          transactions: collector.transactions,
          sqlQueries: collector.sqlQueries,
          rpcCalls: collector.rpcCalls,
          recoveryEvents: collector.recoveryEvents,
          result,
        }),
      );
    }
  });
}

/** Per-method operation scope; the wrapped object never holds a shared collector. */
export function instrumentCompetitiveCommands<T extends object>(target: T, requestId?: string): T {
  return new Proxy(target, {
    get(object, key, receiver) {
      const value = Reflect.get(object, key, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) =>
        observeCompetitiveOperation(
          `attempt.${String(key)}`,
          () => Reflect.apply(value, object, args),
          requestId,
        );
    },
  });
}
