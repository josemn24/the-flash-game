import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

export const DEFAULT_CALENDAR_TICK_URL = "http://localhost:3000/api/internal/calendar/tick";

export function loadLocalEnvironment(cwd = process.cwd()) {
  return loadEnvConfig(cwd, true, true).combinedEnv;
}

export function getCalendarTickConfig(env = process.env) {
  const secret = env.CALENDAR_TICK_SECRET;
  if (!secret) throw new Error("CALENDAR_TICK_SECRET is required.");

  return {
    baseUrl: env.CALENDAR_TICK_URL ?? DEFAULT_CALENDAR_TICK_URL,
    secret,
  };
}

export async function requestCalendarTick({ baseUrl, secret, fetchImpl = fetch }) {
  const response = await fetchImpl(baseUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Calendar tick failed (${response.status}): ${body}`);
  }

  return body;
}
