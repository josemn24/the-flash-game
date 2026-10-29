import { CompetitiveResponseContractError } from "@/lib/competitiveResponseContract";
import { AttemptCommandError } from "@/application/errors/attempts";
import type { AttemptErrorCode } from "@/types/contracts/competitive-errors";
import { InvalidAttemptLifecycleError } from "@/lib/attemptLifecycle";
import {
  competitivePerformanceObserver,
  instrumentCompetitiveCommands,
} from "@/infrastructure/observability/competitivePerformance";
import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/infrastructure/supabase/auth/server-client";
import { AuthServiceUnavailableError } from "@/infrastructure/supabase/auth/auth-availability";
import { getRuntimeScope } from "@/server/runtime-scope";
import { logHttpEvent, requestIdFor, safePath } from "@/server/observability";
import type { AuthenticatedActor, AttemptSessionTokenGenerator } from "@/application/ports/actors";
import type { AttemptUseCases } from "@/application/ports/attempt-use-cases";
import { ApplicationAttemptUseCases } from "@/application/use-cases/attempts";
import {
  consumeCompetitiveRateLimit,
  consumeAlphabetActionRateLimit,
  CompetitiveRateLimitError,
} from "@/server/competitive/rate-limit";
import { SupabaseAttemptCommands } from "@/infrastructure/supabase/attempts/attemptCommands";
import { supabasePrivateQuestionAssetResolver } from "@/infrastructure/supabase/assets/privateQuestionAssetResolver";
import { supabaseCompetitiveEvaluator } from "@/server/evaluation/competitive-evaluator";

const attemptCookiePrefix = "flash-attempt-";
const attemptTokenMaxAgeSeconds = 60 * 60;

export class AttemptApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
    readonly details?: JsonObject,
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

export function requireQueens(body: JsonObject) {
  const value = body.queens;
  if (
    !Array.isArray(value) ||
    value.length > 64 ||
    !value.every((cell) => Number.isSafeInteger(cell) && cell >= 0 && cell < 64) ||
    new Set(value).size !== value.length
  ) {
    throw new AttemptApiError("invalid_queens_answer", 400);
  }
  return value as number[];
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

export async function verifiedIdentity(): Promise<AuthenticatedActor> {
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
    // Next uses the server's bind address (e.g. 0.0.0.0) for request.url.
    // Host carries the actual destination used by the browser on the LAN.
    const host = request.headers.get("host");
    if (host) {
      expectedUrl = new URL(`${expectedUrl.protocol}//${host}`);
      if (
        expectedUrl.username ||
        expectedUrl.password ||
        expectedUrl.pathname !== "/" ||
        expectedUrl.search ||
        expectedUrl.hash
      ) {
        throw new Error("Invalid request host.");
      }
    }
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
 * The scheduled-challenge cookie is a one-device candidate. It lets the server
 * reuse the token after a reload and authorizes an explicit takeover request;
 * it never grants control until PostgreSQL commits the transfer.
 */
export async function readStartAttemptToken(authUserId: string, scheduledChallengeId: string) {
  return (await cookies()).get(startCookieName(authUserId, scheduledChallengeId))?.value;
}

export async function setStartAttemptToken(
  authUserId: string,
  scheduledChallengeId: string,
  token: string,
) {
  (await cookies()).set(startCookieName(authUserId, scheduledChallengeId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/competitive/attempts",
    maxAge: attemptTokenMaxAgeSeconds,
  });
}

export async function setAttemptToken(
  attemptId: string,
  authUserId: string,
  scheduledChallengeId: string,
  token: string,
) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/competitive/attempts",
    // The game deadline controls gameplay, not the ability to persist timeout cleanup.
    // Keep the session for its bounded lifetime; complete/abandon clear it explicitly.
    maxAge: attemptTokenMaxAgeSeconds,
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

export function commandsFor(identity: AuthenticatedActor, requestId?: string) {
  const limit = consumeCompetitiveRateLimit(identity.authUserId);
  void limit;
  const tokenGenerator: AttemptSessionTokenGenerator = { generate: newAttemptToken };
  return instrumentCompetitiveCommands(
    new ApplicationAttemptUseCases({
      actor: identity,
      commands: new SupabaseAttemptCommands(identity),
      evaluator: supabaseCompetitiveEvaluator,
      privateQuestionAssets: supabasePrivateQuestionAssetResolver,
      sessionTokens: tokenGenerator,
      performanceObserver: competitivePerformanceObserver,
      beforeInteractiveAction: ({ attemptId, challengeMode }) => {
        if (challengeMode === "alphabet") {
          consumeAlphabetActionRateLimit(identity.authUserId, attemptId);
        }
      },
    }),
    requestId,
  ) satisfies AttemptUseCases;
}

const attemptErrorStatuses = {
  invalid_backend_response: 502,
  database_unavailable: 503,
  command_failed: 503,
  not_authorized: 404,
  attempt_permission_revoked: 409,
  competitive_access_denied: 404,
  session_revoked: 409,
  session_transferred: 409,
  stale_version: 409,
  idempotency_conflict: 409,
  invalid_command: 409,
  attempt_terminal: 409,
  interaction_not_presented: 409,
  pass_unavailable: 409,
  time_trial_terminal: 409,
  time_trial_not_terminal: 409,
  queens_requires_validation_command: 409,
  evaluation_pending: 409,
  publication_cancelled: 409,
  attempt_not_terminal: 409,
  reason_required: 409,
  invalid_score: 409,
  not_competitive: 409,
  incomplete_challenge: 409,
  unfinished_interaction: 409,
  no_evaluated_answers: 409,
  no_pending_item: 409,
  deadline_reached: 409,
  alphabet_deadline_not_reached: 409,
  receipt_not_found: 409,
  already_evaluated: 409,
  takeover_not_prepared: 409,
  attempt_inactivity_expired: 409,
  recovery_required: 409,
  invalid_mini_wordle_guess: 400,
  duplicate_mini_wordle_guess: 409,
  mini_wordle_requires_guess_command: 400,
  invalid_logic_code: 400,
  duplicate_logic_code: 409,
  logic_code_requires_attempt_command: 400,
  invalid_matching_answer: 409,
  invalid_connect_pairs_answer: 422,
  invalid_word_search_selection: 409,
  word_search_target_already_found: 409,
  word_search_requires_selection_command: 409,
  invalid_word_hashtag_swap: 400,
  word_hashtag_moves_exhausted: 409,
  word_hashtag_requires_swap_command: 400,
  invalid_queens_placement: 409,
  invalid_queens_answer: 400,
  queens_answer_incomplete: 400,
  queens_answer_overflow: 400,
  queens_requires_placement_command: 409,
  queens_requires_board_validation: 400,
  prefilled_queen_locked: 409,
  all_clues_revealed: 409,
  progressive_clues_requires_reveal_command: 409,
  unsupported_question: 400,
  invalid_question_payload: 400,
  invalid_attempt_context: 409,
  invalid_attempt_lifecycle: 500,
  survival_not_terminal: 409,
  pyramid_not_terminal: 409,
  request_predates_presentation: 409,
  pyramid_level_failed: 409,
  duplicate_queens_placement: 409,
  invalid_progress: 503,
  invalid_question_solution: 503,
  invalid_question_config: 503,
  auth_unavailable: 503,
} as const satisfies Record<AttemptErrorCode, number>;

export function mapAttemptError(error: unknown): AttemptApiError {
  if (error instanceof AuthServiceUnavailableError)
    return new AttemptApiError("auth_unavailable", 503);
  if (error instanceof AttemptApiError) return error;
  if (
    error instanceof InvalidAttemptLifecycleError ||
    (error instanceof AttemptCommandError && error.code === "invalid_attempt_lifecycle")
  ) {
    return new AttemptApiError("invalid_attempt_lifecycle", 500);
  }
  if (error instanceof AttemptCommandError) {
    return new AttemptApiError(
      error.code,
      attemptErrorStatuses[error.code],
      error.retryAfterSeconds,
    );
  }
  if (error instanceof CompetitiveRateLimitError) {
    return new AttemptApiError(error.code, error.status, error.retryAfterSeconds);
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
    ...(error instanceof AttemptCommandError &&
    error.cause instanceof CompetitiveResponseContractError
      ? { responsePath: error.cause.path }
      : {}),
    durationMs: Date.now() - startedAt,
  });
  return Response.json(
    {
      error: {
        code: mapped.code,
        requestId,
        ...(mapped.code === "attempt_session_missing"
          ? { message: "Recarga la página para preparar la sesión antes de empezar." }
          : {}),
      },
    },
    {
      status: mapped.status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
        ...(mapped.status === 429 || mapped.retryAfterSeconds !== undefined
          ? { "Retry-After": String(mapped.retryAfterSeconds ?? 1) }
          : {}),
      },
    },
  );
}

export { requestIdFor, safePath };
