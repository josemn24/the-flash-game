import {
  competitivePerformanceObserver,
  countCompetitiveDatabaseCall,
} from "@/infrastructure/observability/competitivePerformance";
import "server-only";

import { Pool, type PoolClient } from "pg";
import {
  decodeAttemptRecoverySnapshot,
  decodeFinishAttemptResult,
  decodeSavedAttemptResult,
  decodeSavedAbandonedAttemptResult,
} from "./attemptLifecycleContracts";
import type {
  AttemptCommands,
  AttemptContext,
  EvaluationContext,
  RecordEvaluationCommand,
  RecoverAttemptCommand,
  StartAttemptCommand,
  TakeOverAttemptCommand,
} from "@/application/ports/attempt-commands";
import type {
  ActivateInteractionResult,
  PrepareInteractionResult,
  ReceiveAnswerResult,
  StartAttemptResult,
  TakeOverAttemptResult,
  SubmitAnswerInput,
  SubmitAnswerResult,
  RecoverAttemptResult,
  AttemptRecoverySnapshot,
  SubmitMiniWordleGuessResult,
  SubmitWordSearchSelectionResult,
  SubmitWordHashtagSwapResult,
  SubmitLogicCodeAttemptResult,
  SubmitQueensPlacementResult,
  SaveQueensDraftResult,
  ValidateQueensBoardResult,
  RevealProgressiveClueResult,
  PassInteractionResult,
} from "@/types/contracts/attempts";
import type { AnswerReceiptId } from "@/types/domain/identifiers";
import { getSupabaseDatabaseUrl } from "@/infrastructure/supabase/platform/databaseUrl";
import { AttemptCommandError } from "@/application/errors/attempts";
import { isAttemptErrorCode } from "@/lib/competitiveErrors";
import type { AttemptErrorCode } from "@/types/contracts/competitive-errors";
import { countAlphabetAnswerCharacters } from "@/lib/gameplay/alphabetAnswerSlots";

export { AttemptCommandError } from "@/infrastructure/supabase/attempts/attemptCommandError";

const poolKey = Symbol.for("the-flash-game.supabase.attempt-pool");
const globalPool = globalThis as typeof globalThis & { [poolKey]?: Pool };

export type VerifiedAuthIdentity = {
  readonly authUserId: string;
};

function connectionString() {
  try {
    return getSupabaseDatabaseUrl();
  } catch (error) {
    throw new AttemptCommandError("database_unavailable", error);
  }
}

function getPool() {
  if (!globalPool[poolKey]) {
    globalPool[poolKey] = new Pool({
      connectionString: connectionString(),
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      application_name: "the-flash-game-web",
    });
  }
  return globalPool[poolKey]!;
}

async function beginAsServiceRole(client: PoolClient, identity: VerifiedAuthIdentity) {
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = '5000ms'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '10000ms'");
  await client.query("SET LOCAL ROLE service_role");
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: identity.authUserId, role: "authenticated", is_anonymous: false }),
  ]);
}

function commandCode(error: unknown): AttemptErrorCode {
  if (error instanceof AttemptCommandError) return error.code;
  const infrastructureCode =
    error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  if (
    infrastructureCode === "23514" &&
    error &&
    typeof error === "object" &&
    "constraint" in error &&
    [
      "attempts_outcome_values_check",
      "attempts_outcome_status_check",
      "attempts_status_check",
    ].includes(String(error.constraint))
  ) {
    return "invalid_attempt_lifecycle";
  }
  if (isAttemptErrorCode(message)) return message;
  if (
    infrastructureCode.startsWith("08") ||
    ["28P01", "28000", "42501"].includes(infrastructureCode) ||
    ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EPIPE"].includes(infrastructureCode) ||
    /connection|timeout|socket/i.test(message)
  ) {
    return "database_unavailable";
  }
  return "command_failed";
}

function commandError(error: unknown): AttemptCommandError {
  if (error instanceof AttemptCommandError) return error;
  const code = commandCode(error);
  let retryAfterSeconds: number | undefined;
  if (
    code === "alphabet_deadline_not_reached" &&
    error &&
    typeof error === "object" &&
    "detail" in error
  ) {
    try {
      const detail = JSON.parse(String(error.detail)) as { retryAfterSeconds?: unknown };
      const seconds = Number(detail.retryAfterSeconds);
      if (Number.isSafeInteger(seconds) && seconds > 0) retryAfterSeconds = seconds;
    } catch {
      // Invalid database diagnostics must not hide the original error.
    }
  }
  return new AttemptCommandError(code, error, retryAfterSeconds);
}

async function transaction<T>(
  identity: VerifiedAuthIdentity,
  run: (client: PoolClient) => Promise<T>,
) {
  const connection = await competitivePerformanceObserver.measure("pool.wait", () =>
    getPool().connect(),
  );
  const client = new Proxy(connection, {
    get(target, key) {
      if (key === "query")
        return (...args: unknown[]) => {
          countCompetitiveDatabaseCall("sqlQueries");
          return Reflect.apply(target.query, target, args);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  countCompetitiveDatabaseCall("transactions");
  try {
    await beginAsServiceRole(client, identity);
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      // Expiry is a durable terminal transition, not a failed gameplay mutation.
      await client.query(
        error instanceof AttemptCommandError && error.code === "attempt_inactivity_expired"
          ? "COMMIT"
          : "ROLLBACK",
      );
    } catch (finalizationError) {
      if (error instanceof AttemptCommandError && error.code === "attempt_inactivity_expired") {
        throw commandError(finalizationError);
      }
      // The original database error is the useful one for the API mapper.
    }
    throw commandError(error);
  } finally {
    client.release();
  }
}

export async function callAttemptCommand<T>(
  identity: VerifiedAuthIdentity,
  functionName: string,
  input: object,
  decode?: (value: unknown, client: PoolClient) => T | Promise<T>,
): Promise<T> {
  return transaction(identity, async (client) => {
    if ("attemptId" in input && typeof input.attemptId === "string" && input.attemptId.length > 0) {
      await expireStaleAttempt(client, input.attemptId);
    }
    const result = await client.query<{ result: unknown }>(
      `select private.${functionName}($1::jsonb) as result`,
      [JSON.stringify(input)],
    );
    const response = await refreshTimeTrialReference(client, result.rows[0]?.result);
    return decode ? decode(response, client) : (response as T);
  });
}

/** Idempotent facts retain their original timestamps; the display clock gets a fresh database reference even on replay. */
async function refreshTimeTrialReference(client: PoolClient, value: unknown): Promise<unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    !("timeTrial" in value) ||
    !value.timeTrial ||
    typeof value.timeTrial !== "object"
  )
    return value;
  const clock = await client.query<{ server_now: string }>(
    "select clock_timestamp()::text as server_now",
  );
  return { ...value, timeTrial: { ...value.timeTrial, serverNow: clock.rows[0]?.server_now } };
}

async function expireStaleAttempt(client: PoolClient, attemptId: string) {
  const result = await client.query<{ result: { abandonedAttempts?: number } }>(
    "select private.expire_stale_attempts($1::jsonb) as result",
    [JSON.stringify({ runId: `recovery-${attemptId}`, attemptId })],
  );
  if (result.rows[0]?.result?.abandonedAttempts && result.rows[0].result.abandonedAttempts > 0) {
    throw new AttemptCommandError("attempt_inactivity_expired");
  }
}

function isAttemptContext(value: unknown): value is AttemptContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const context = value as Record<string, unknown>;
  return (
    Object.keys(context).length === 2 &&
    typeof context.challengeMode === "string" &&
    ["flash", "alphabet", "survival", "pyramid", "narrative", "time-trial"].includes(
      context.challengeMode,
    ) &&
    typeof context.scheduledChallengeId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      context.scheduledChallengeId,
    )
  );
}

export class SupabaseAttemptCommands implements Pick<
  AttemptCommands,
  | "start"
  | "takeOver"
  | "prepareSession"
  | "readCompletedAttempt"
  | "readAbandonedAttempt"
  | "readRecordedEvaluation"
  | "prepare"
  | "activate"
  | "receiveAnswer"
  | "pass"
  | "submitWordSearchSelection"
  | "submitWordHashtagSwap"
  | "submitMiniWordleGuess"
  | "submitLogicCodeAttempt"
  | "submitQueensPlacement"
  | "saveQueensDraft"
  | "validateQueensBoard"
  | "revealProgressiveClue"
  | "readEvaluationContext"
  | "recordEvaluation"
  | "completeFromPersistedAnswers"
  | "abandon"
  | "recover"
  | "readAttemptContext"
  | "readRecovery"
> {
  constructor(private readonly identity: VerifiedAuthIdentity) {}

  async prepareSession(input: Parameters<AttemptCommands["prepareSession"]>[0]) {
    await transaction(this.identity, (client) =>
      client.query("select private.prepare_attempt_session($1::uuid)", [
        input.scheduledChallengeId,
      ]),
    );
  }

  readCompletedAttempt(attemptId: string) {
    return transaction(this.identity, async (client) => {
      const response = await client.query<{
        result: unknown;
      }>("select private.read_completed_attempt($1::uuid) as result", [attemptId]);
      return decodeSavedAttemptResult(response.rows[0]?.result);
    });
  }

  readRecordedEvaluation(receiptId: AnswerReceiptId, sessionToken: string) {
    return transaction(this.identity, async (client) => {
      const response = await client.query<{ result: SubmitAnswerResult | null }>(
        "select private.read_recorded_evaluation($1::uuid, $2::text) as result",
        [receiptId, sessionToken],
      );
      return response.rows[0]?.result ?? null;
    });
  }

  readAbandonedAttempt(attemptId: string) {
    return transaction(this.identity, async (client) => {
      const response = await client.query<{
        result: unknown;
      }>("select private.read_abandoned_attempt($1::uuid) as result", [attemptId]);
      return decodeSavedAbandonedAttemptResult(response.rows[0]?.result);
    });
  }
  start(input: StartAttemptCommand) {
    return callAttemptCommand<StartAttemptResult>(this.identity, "start_attempt", input);
  }

  takeOver(input: TakeOverAttemptCommand) {
    return callAttemptCommand<TakeOverAttemptResult>(this.identity, "take_over_attempt", input);
  }

  async prepare(input: Parameters<AttemptCommands["prepare"]>[0]) {
    return callAttemptCommand<PrepareInteractionResult>(
      this.identity,
      "prepare_interaction",
      input,
      async (value, client) => {
        const prepared = value as PrepareInteractionResult;
        const progress = prepared.progress;
        if (
          !prepared.publicPayload ||
          prepared.questionType !== "short-text" ||
          !progress ||
          typeof progress !== "object" ||
          Array.isArray(progress) ||
          !("kind" in progress) ||
          progress.kind !== "alphabet"
        ) {
          return prepared;
        }
        // The source stays inside this transaction; neither the API nor command receipts receive it.
        const source = await client.query<{ principal_answer: string }>(
          "select private.read_alphabet_answer_hint_source($1::uuid, $2::uuid, $3::text) as principal_answer",
          [input.attemptId, prepared.challengeItemId, input.sessionToken],
        );
        const principal = source.rows[0]?.principal_answer;
        if (typeof principal !== "string")
          throw new AttemptCommandError("invalid_question_payload");
        return { ...prepared, answerLength: countAlphabetAnswerCharacters(principal) || null };
      },
    );
  }

  activate(input: Parameters<AttemptCommands["activate"]>[0]) {
    return callAttemptCommand<ActivateInteractionResult>(
      this.identity,
      "activate_interaction",
      input,
    );
  }

  receiveAnswer(input: SubmitAnswerInput) {
    return callAttemptCommand<ReceiveAnswerResult>(this.identity, "receive_answer", input);
  }

  pass(input: Parameters<AttemptCommands["pass"]>[0]) {
    return callAttemptCommand<PassInteractionResult>(this.identity, "pass_interaction", input);
  }

  submitMiniWordleGuess(input: Parameters<AttemptCommands["submitMiniWordleGuess"]>[0]) {
    return callAttemptCommand<SubmitMiniWordleGuessResult>(
      this.identity,
      "submit_mini_wordle_guess",
      input,
    );
  }

  submitWordSearchSelection(input: Parameters<AttemptCommands["submitWordSearchSelection"]>[0]) {
    return callAttemptCommand<SubmitWordSearchSelectionResult>(
      this.identity,
      "submit_word_search_selection",
      input,
    );
  }

  submitWordHashtagSwap(input: Parameters<AttemptCommands["submitWordHashtagSwap"]>[0]) {
    return callAttemptCommand<SubmitWordHashtagSwapResult>(
      this.identity,
      "submit_word_hashtag_swap",
      input,
    );
  }

  submitLogicCodeAttempt(input: Parameters<AttemptCommands["submitLogicCodeAttempt"]>[0]) {
    return callAttemptCommand<SubmitLogicCodeAttemptResult>(
      this.identity,
      "submit_logic_code_attempt",
      input,
    );
  }

  submitQueensPlacement(input: Parameters<AttemptCommands["submitQueensPlacement"]>[0]) {
    return callAttemptCommand<SubmitQueensPlacementResult>(
      this.identity,
      "submit_queens_placement",
      input,
    );
  }

  saveQueensDraft(input: Parameters<AttemptCommands["saveQueensDraft"]>[0]) {
    return callAttemptCommand<SaveQueensDraftResult>(this.identity, "save_queens_draft", input);
  }

  validateQueensBoard(input: Parameters<AttemptCommands["validateQueensBoard"]>[0]) {
    return callAttemptCommand<ValidateQueensBoardResult>(
      this.identity,
      "submit_queens_answer",
      input,
    );
  }

  revealProgressiveClue(input: Parameters<AttemptCommands["revealProgressiveClue"]>[0]) {
    return callAttemptCommand<RevealProgressiveClueResult>(
      this.identity,
      "reveal_progressive_clue",
      input,
    );
  }

  readEvaluationContext(receiptId: AnswerReceiptId, sessionToken: string) {
    return transaction<EvaluationContext>(this.identity, async (client) => {
      const result = await client.query<{ read_evaluation_context: EvaluationContext }>(
        "select private.read_evaluation_context($1::uuid, $2::text)",
        [receiptId, sessionToken],
      );
      return result.rows[0]?.read_evaluation_context as EvaluationContext;
    });
  }

  recordEvaluation(input: RecordEvaluationCommand) {
    return callAttemptCommand<SubmitAnswerResult>(this.identity, "record_evaluation", input);
  }

  async abandon(input: Parameters<AttemptCommands["abandon"]>[0]) {
    return callAttemptCommand(this.identity, "abandon_attempt", input, decodeFinishAttemptResult);
  }

  recover(input: RecoverAttemptCommand) {
    return callAttemptCommand<RecoverAttemptResult>(this.identity, "recover_attempt", input);
  }

  readAttemptContext(attemptId: string, sessionToken: string) {
    return transaction<AttemptContext>(this.identity, async (client) => {
      await expireStaleAttempt(client, attemptId);
      const result = await client.query<{ read_attempt_context: unknown }>(
        "select private.read_attempt_context($1::uuid, $2::text)",
        [attemptId, sessionToken],
      );
      const context = result.rows[0]?.read_attempt_context;
      if (!isAttemptContext(context)) throw new AttemptCommandError("invalid_attempt_context");
      return context;
    });
  }

  readRecovery(attemptId: string, sessionToken: string) {
    return transaction<AttemptRecoverySnapshot>(this.identity, async (client) => {
      await expireStaleAttempt(client, attemptId);
      const result = await client.query<{ read_attempt_recovery: unknown }>(
        "select private.read_attempt_recovery($1::uuid, $2::text)",
        [attemptId, sessionToken],
      );
      return decodeAttemptRecoverySnapshot(result.rows[0]?.read_attempt_recovery);
    });
  }

  completeFromPersistedAnswers(
    input: Parameters<AttemptCommands["completeFromPersistedAnswers"]>[0],
  ) {
    return callAttemptCommand(this.identity, "complete_attempt", input, decodeFinishAttemptResult);
  }
}
