import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getRuntimeScope } from "@/server/runtime-scope";
import { logHttpEvent, requestIdFor, safePath } from "@/server/observability";
import {
  consumeCompetitiveRateLimit,
  CompetitiveRateLimitError,
} from "@/server/competitive/rate-limit";
import {
  AttemptCommandError,
  SupabaseAttemptCommands,
  type VerifiedAuthIdentity,
} from "@/infrastructure/supabase/attemptCommands";

const attemptCookiePrefix = "flash-attempt-";
const attemptTokenMaxAgeSeconds = 60 * 60;

export class AttemptApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "AttemptApiError";
  }
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function isKey(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 160;
}

function isLockVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

const competitiveBodyLimitBytes = 32 * 1024;

export async function readJson(
  request: Request,
  maxBytes = competitiveBodyLimitBytes,
): Promise<JsonObject> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maxBytes) {
    throw new AttemptApiError("body_too_large", 413);
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    throw new AttemptApiError("invalid_json", 400);
  }
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new AttemptApiError("body_too_large", 413);
  }

  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new AttemptApiError("invalid_json", 400);
  }
  if (!isObject(value)) throw new AttemptApiError("invalid_body", 400);
  return value;
}

export function requireUuid(body: JsonObject, key: string) {
  const value = body[key];
  if (!isUuid(value)) throw new AttemptApiError(`invalid_${key}`, 400);
  return value;
}

export function requireText(body: JsonObject, key: string, maxLength = 120) {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new AttemptApiError(`invalid_${key}`, 400);
  }
  return value.trim();
}

export function requirePathUuid(value: string, key = "attempt_id") {
  if (!isUuid(value)) throw new AttemptApiError(`invalid_${key}`, 400);
  return value;
}

export function requireKey(body: JsonObject) {
  if (!isKey(body.idempotencyKey)) throw new AttemptApiError("invalid_idempotency_key", 400);
  return body.idempotencyKey;
}

export function requireLockVersion(body: JsonObject) {
  if (!isLockVersion(body.lockVersion)) throw new AttemptApiError("invalid_lock_version", 400);
  return body.lockVersion;
}

export function requireCell(
  body: JsonObject,
  key: "startCell" | "endCell" | "fromCell" | "toCell",
) {
  const value = body[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new AttemptApiError(`invalid_${key}`, 400);
  }
  return value;
}

export function optionalClientTime(body: JsonObject) {
  if (body.clientTimeUsedMs === undefined) return undefined;
  if (
    typeof body.clientTimeUsedMs !== "number" ||
    !Number.isSafeInteger(body.clientTimeUsedMs) ||
    body.clientTimeUsedMs < 0
  ) {
    throw new AttemptApiError("invalid_client_time", 400);
  }
  return body.clientTimeUsedMs;
}

export async function verifiedIdentity(): Promise<VerifiedAuthIdentity> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    const missingSession =
      error.name === "AuthSessionMissingError" ||
      error.code === "session_not_found" ||
      error.message.toLowerCase().includes("auth session missing");
    throw new AttemptApiError(
      missingSession ? "not_authenticated" : "auth_unavailable",
      missingSession ? 401 : 503,
    );
  }
  if (!data.user) throw new AttemptApiError("not_authenticated", 401);
  return { authUserId: data.user.id };
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (getRuntimeScope() === "pilot") {
    const expected = process.env.APP_ORIGIN;
    if (!expected || !origin || origin !== expected) {
      throw new AttemptApiError("invalid_origin", 403);
    }
    return;
  }
  if (!origin) return;
  let actualUrl: URL;
  let expectedUrl: URL;
  try {
    actualUrl = new URL(origin);
    expectedUrl = new URL(request.url);
  } catch {
    throw new AttemptApiError("invalid_origin", 403);
  }
  if (origin === expectedUrl.origin) return;
  const localAliases = new Set(["localhost", "127.0.0.1", "::1"]);
  if (
    !localAliases.has(actualUrl.hostname) ||
    !localAliases.has(expectedUrl.hostname) ||
    actualUrl.port !== expectedUrl.port
  ) {
    throw new AttemptApiError("invalid_origin", 403);
  }
}

export function newAttemptToken() {
  return randomBytes(32).toString("base64url");
}

function cookieName(attemptId: string) {
  return `${attemptCookiePrefix}${attemptId}`;
}

function startCookieName(authUserId: string, scheduledChallengeId: string) {
  return `${attemptCookiePrefix}scheduled-${authUserId}-${scheduledChallengeId}`;
}

export async function readAttemptToken(attemptId: string) {
  const value = (await cookies()).get(cookieName(attemptId))?.value;
  if (!value) throw new AttemptApiError("attempt_session_missing", 401);
  return value;
}

/**
 * The scheduled-challenge cookie lets the server reuse the controlling token after a reload.
 * It is still HttpOnly: a different browser/device does not receive it and remains blocked.
 */
export async function readStartAttemptToken(authUserId: string, scheduledChallengeId: string) {
  return (await cookies()).get(startCookieName(authUserId, scheduledChallengeId))?.value;
}

export async function setAttemptToken(
  attemptId: string,
  authUserId: string,
  scheduledChallengeId: string,
  token: string,
  deadlineAt?: string | null,
) {
  const maxAge = deadlineAt
    ? Math.max(
        60,
        Math.min(
          attemptTokenMaxAgeSeconds,
          Math.ceil((Date.parse(deadlineAt) - Date.now()) / 1000),
        ),
      )
    : attemptTokenMaxAgeSeconds;
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/competitive/attempts",
    maxAge,
  } as const;
  const store = await cookies();
  store.set(cookieName(attemptId), token, options);
  store.set(startCookieName(authUserId, scheduledChallengeId), token, options);
}

export async function clearAttemptToken(
  attemptId: string,
  authUserId?: string,
  scheduledChallengeId?: string,
) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/competitive/attempts",
    maxAge: 0,
  } as const;
  const store = await cookies();
  store.set(cookieName(attemptId), "", options);
  if (authUserId && scheduledChallengeId) {
    store.set(startCookieName(authUserId, scheduledChallengeId), "", options);
  }
}

export function commandsFor(identity: VerifiedAuthIdentity) {
  const limit = consumeCompetitiveRateLimit(identity.authUserId);
  void limit;
  return new SupabaseAttemptCommands(identity);
}

export function mapAttemptError(error: unknown): AttemptApiError {
  if (error instanceof AttemptApiError) return error;
  if (error instanceof AttemptCommandError) {
    const status =
      error.code === "invalid_mini_wordle_guess" ||
      error.code === "mini_wordle_requires_guess_command" ||
      error.code === "invalid_logic_code" ||
      error.code === "logic_code_requires_attempt_command" ||
      error.code === "invalid_word_hashtag_swap" ||
      error.code === "word_hashtag_requires_swap_command" ||
      error.code === "invalid_question_payload" ||
      error.code === "unsupported_question"
        ? 400
        : error.code === "not_authorized" || error.code === "competitive_access_denied"
          ? 404
          : error.code === "auth_unavailable" ||
              error.code === "database_unavailable" ||
              error.code === "command_failed"
            ? 503
            : 409;
    return new AttemptApiError(error.code, status);
  }
  if (error instanceof CompetitiveRateLimitError) {
    return new AttemptApiError(error.code, error.status);
  }
  return new AttemptApiError("command_failed", 500);
}

export function responseFor(
  value: unknown,
  status = 200,
  requestId: string = randomUUID(),
  operation: string = "competitive.attempt",
  startedAt = Date.now(),
) {
  logHttpEvent({
    requestId,
    route: operation,
    operation,
    status,
    result: status >= 400 ? "error" : "ok",
    durationMs: Date.now() - startedAt,
  });
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      ...(status === 429 ? { "Retry-After": "60" } : {}),
    },
  });
}

export function errorResponse(
  error: unknown,
  requestId: string = randomUUID(),
  operation: string = "competitive.attempt",
  startedAt = Date.now(),
) {
  const mapped = mapAttemptError(error);
  logHttpEvent({
    requestId,
    route: operation,
    operation,
    status: mapped.status,
    result: "error",
    errorCode: mapped.code,
    durationMs: Date.now() - startedAt,
  });
  return Response.json(
    { error: { code: mapped.code, requestId } },
    {
      status: mapped.status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
        ...(mapped.status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}

export { requestIdFor, safePath };
