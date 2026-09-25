import "server-only";

import { randomUUID } from "node:crypto";

const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

export type HttpLogFields = {
  readonly requestId: string;
  readonly route: string;
  readonly operation: string;
  readonly status: number;
  readonly durationMs?: number;
  readonly result?: "ok" | "error";
  readonly errorCode?: string;
  readonly attemptId?: string;
  readonly receiptId?: string;
};

export function requestIdFor(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && requestIdPattern.test(supplied) ? supplied : randomUUID();
}

export function logHttpEvent(fields: HttpLogFields) {
  // Keep the allow-list explicit: request bodies, cookies, JWTs and database
  // payloads must never reach the application log.
  console.info(
    JSON.stringify({
      event: "http_request",
      ...fields,
      ...(fields.durationMs === undefined ? {} : { durationMs: Math.round(fields.durationMs) }),
    }),
  );
}

export function safePath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
}

export function jsonResponse(
  value: unknown,
  status: number,
  requestId: string,
  headers: HeadersInit = {},
) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      ...headers,
    },
  });
}
