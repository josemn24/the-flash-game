import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";
import { createSessionClient } from "./session-client";
import {
  AUTH_BUDGET_MS,
  AUTH_DEADLINE_HEADER,
  AUTH_FAILURE_HEADER,
  AuthAvailability,
} from "./auth-availability";
import { logHttpEvent } from "@/infrastructure/observability/http";
import { randomUUID } from "node:crypto";

const requestAvailability = cache(async () => {
  const requestHeaders = await headers();
  const startedAt = Date.now();
  const suppliedDeadline = Number(requestHeaders.get(AUTH_DEADLINE_HEADER));
  const deadline =
    suppliedDeadline > 0 && Number.isFinite(suppliedDeadline)
      ? Math.min(suppliedDeadline, startedAt + AUTH_BUDGET_MS)
      : startedAt + AUTH_BUDGET_MS;
  const failure = requestHeaders.get(AUTH_FAILURE_HEADER);
  const availability = new AuthAvailability(deadline, fetch, (error) => {
    if (failure) return;
    logHttpEvent({
      requestId: randomUUID(),
      route: "server",
      operation: "auth.session",
      status: 503,
      result: "error",
      errorCode: `auth_${error.reason}`,
      durationMs: Date.now() - startedAt,
    });
  });
  if (failure === "connection" || failure === "service" || failure === "timeout") {
    // The proxy already logged and exhausted this request's Auth attempt.
    availability.fail(failure);
  }
  return availability;
});

export async function createClient() {
  const cookieStore = await cookies();
  const availability = await requestAvailability();
  if (availability.failure) throw availability.failure;

  return createSessionClient(
    {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. proxy.ts refreshes them first.
        }
      },
    },
    availability,
  );
}
