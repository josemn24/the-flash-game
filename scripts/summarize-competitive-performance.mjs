import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function percentile(values, quantile) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
}

export function summarizePerformance(contents) {
  const groups = new Map();
  for (const line of contents.split("\n")) {
    // Accept plain JSONL and Playwright's prefixed web-server output.
    const start = line.indexOf('{"event":"competitive_performance"');
    if (start < 0) continue;
    let event;
    try {
      event = JSON.parse(
        line
          .slice(start)
          .replace(/\u001b\[[0-9;]*m/g, "")
          .trim(),
      );
    } catch {
      continue;
    }
    if (event.event !== "competitive_performance" || typeof event.operation !== "string") continue;
    const samples = {
      total: event.durationMs,
      ...event.phases,
      transactions: event.transactions,
      sqlQueries: event.sqlQueries,
      rpcCalls: event.rpcCalls,
    };
    for (const [phase, value] of Object.entries(samples)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
      const key = JSON.stringify([event.operation, event.mode ?? "unknown", event.result, phase]);
      const values = groups.get(key) ?? [];
      values.push(value);
      groups.set(key, values);
    }
  }
  return [...groups]
    .map(([key, values]) => {
      const [operation, mode, result, phase] = JSON.parse(key);
      return {
        operation,
        mode,
        result,
        phase,
        samples: values.length,
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
      };
    })
    .sort((a, b) =>
      `${a.operation}/${a.mode}/${a.result}/${a.phase}`.localeCompare(
        `${b.operation}/${b.mode}/${b.result}/${b.phase}`,
      ),
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const filename = process.argv[2];
  if (!filename) {
    console.error("Usage: npm run performance:summary -- <JSONL-or-test-log>");
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(summarizePerformance(await readFile(filename, "utf8")), null, 2));
  }
}
