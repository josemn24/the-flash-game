import { test } from "vitest";
import assert from "node:assert/strict";
import { summarizePerformance } from "./summarize-competitive-performance.mjs";

test("summarizes prefixed logs by operation, mode, outcome and phase", () => {
  const logs = Array.from(
    { length: 20 },
    (_, index) =>
      `[WebServer] ${JSON.stringify({ event: "competitive_performance", operation: "challenge.read", mode: "flash", result: "ok", durationMs: index + 1, phases: { "challenge.initial": index + 1 }, rpcCalls: 1 })}`,
  ).join("\n");
  const result = summarizePerformance(`${logs}\ninvalid\n{"event":"other"}`);
  assert.deepEqual(
    result.find((row) => row.phase === "total"),
    {
      operation: "challenge.read",
      mode: "flash",
      result: "ok",
      phase: "total",
      samples: 20,
      p50: 10,
      p95: 19,
    },
  );
  assert.equal(result.find((row) => row.phase === "rpcCalls").p95, 1);
});
