import { afterEach, describe, expect, it, vi } from "vitest";
import {
  competitivePerformanceObserver as observer,
  countCompetitiveDatabaseCall as count,
  observeCompetitiveOperation as operation,
} from "./competitivePerformance";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("competitive performance diagnostics", () => {
  it("does not log or keep counters when disabled", async () => {
    vi.stubEnv("FLASH_PERFORMANCE_DIAGNOSTICS", "0");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(
      await operation("attempt.answer", () => {
        count("transactions");
        return "value";
      }),
    ).toBe("value");
    expect(log).not.toHaveBeenCalled();
  });

  it("isolates concurrent operations and exposes only diagnostic fields", async () => {
    vi.stubEnv("FLASH_PERFORMANCE_DIAGNOSTICS", "1");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = operation(
      "attempt.answer",
      async () => {
        observer.setMode("alphabet");
        observer.recordRecovery?.("receipt_pending");
        observer.recordRecovery?.("evaluation_recovered");
        count("transactions");
        await observer.measure("attempt.scoring", () => pending);
        count("sqlQueries");
        return { answer: "private-answer", token: "secret-token" };
      },
      "request-123",
    );
    await operation("challenge.read", () => {
      observer.setMode("narrative");
      count("rpcCalls");
      release();
    });
    await first;
    const events = log.mock.calls.map(([line]) => JSON.parse(line as string));
    const answer = events.find((event) => event.operation === "attempt.answer");
    const read = events.find((event) => event.operation === "challenge.read");
    expect(answer).toMatchObject({
      mode: "alphabet",
      requestId: "request-123",
      transactions: 1,
      sqlQueries: 1,
      rpcCalls: 0,
      result: "ok",
      recoveryEvents: { receipt_pending: 1, evaluation_recovered: 1 },
    });
    expect(read).toMatchObject({ mode: "narrative", transactions: 0, sqlQueries: 0, rpcCalls: 1 });
    expect(answer.phases["attempt.scoring"]).toBeGreaterThanOrEqual(0);
    expect(answer.operationId).not.toBe(read.operationId);
    expect(JSON.stringify(events)).not.toMatch(/private-answer|secret-token/);
  });

  it("records failure without logging error contents or changing the error", async () => {
    vi.stubEnv("FLASH_PERFORMANCE_DIAGNOSTICS", "1");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = new Error("secret SQL and credentials");
    await expect(
      operation("attempt.answer", () =>
        observer.measure("attempt.receive", () => {
          throw error;
        }),
      ),
    ).rejects.toBe(error);
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({ result: "error" });
    expect(log.mock.calls[0][0]).not.toContain(error.message);
  });

  it("measures nested enrichment once", async () => {
    vi.stubEnv("FLASH_PERFORMANCE_DIAGNOSTICS", "1");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    let tick = 0;
    vi.spyOn(performance, "now").mockImplementation(() => ++tick);
    await operation("challenge.read", () =>
      observer.measure("challenge.enrichment", () =>
        observer.measure("challenge.enrichment", () => count("rpcCalls")),
      ),
    );
    const event = JSON.parse(log.mock.calls[0][0] as string);
    expect(event.phases["challenge.enrichment"]).toBe(1);
    expect(event.rpcCalls).toBe(1);
  });
});
