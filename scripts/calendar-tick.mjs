import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getCalendarTickConfig,
  loadLocalEnvironment,
  requestCalendarTick,
} from "./calendar-tick-client.mjs";

export async function runCalendarTick({ env = process.env, fetchImpl = fetch } = {}) {
  const config = getCalendarTickConfig(env);
  return requestCalendarTick({ ...config, fetchImpl });
}

export async function main({ env, fetchImpl = fetch } = {}) {
  try {
    console.log(await runCalendarTick({ env: env ?? loadLocalEnvironment(), fetchImpl }));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
