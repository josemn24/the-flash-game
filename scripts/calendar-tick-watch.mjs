import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getCalendarTickConfig,
  loadLocalEnvironment,
  requestCalendarTick,
} from "./calendar-tick-client.mjs";

export const DEFAULT_INTERVAL_SECONDS = 60;
const USAGE = "Uso: npm run calendar:tick:watch -- [--interval-seconds=<segundos positivos>]";

export function parseWatchArgs(args) {
  let intervalSeconds = DEFAULT_INTERVAL_SECONDS;

  for (const argument of args) {
    if (!argument.startsWith("--interval-seconds=")) {
      throw new Error(`Argumento desconocido: ${argument}\n${USAGE}`);
    }

    const rawValue = argument.slice("--interval-seconds=".length);
    const parsedValue = Number(rawValue);
    if (!/^\d+$/.test(rawValue) || !Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
      throw new Error(`El intervalo debe ser un entero positivo en segundos.\n${USAGE}`);
    }
    intervalSeconds = parsedValue;
  }

  return { intervalSeconds };
}

export function waitForNextTick(intervalSeconds, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, intervalSeconds * 1000);
    const onAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function runCalendarTickWatch({
  intervalSeconds,
  signal,
  tick,
  log = console.log,
  logError = console.error,
}) {
  while (!signal.aborted) {
    try {
      log(await tick());
    } catch (error) {
      logError(error instanceof Error ? error.message : String(error));
    }

    if (!signal.aborted) await waitForNextTick(intervalSeconds, signal);
  }
}

export async function main({ args = process.argv.slice(2), env } = {}) {
  let options;
  try {
    options = parseWatchArgs(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  let config;
  try {
    config = getCalendarTickConfig(env ?? loadLocalEnvironment());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const controller = new AbortController();
  const stop = () => {
    if (!controller.signal.aborted) {
      console.log("Calendar tick watcher detenido.");
      controller.abort();
    }
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  console.log(`Calendar tick watcher activo; intervalo: ${options.intervalSeconds}s.`);
  await runCalendarTickWatch({
    intervalSeconds: options.intervalSeconds,
    signal: controller.signal,
    tick: () => requestCalendarTick(config),
  });
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
