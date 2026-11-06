import type { SubmitAnswerInput, AttemptRecoverySnapshot } from "@/types/contracts/attempts";
import {
  competitivePerformanceObserver,
  countCompetitiveDatabaseCall,
} from "@/infrastructure/observability/competitivePerformance";
import "server-only";

import { Pool, type PoolClient } from "pg";
import {
  decodeAttemptRecoverySnapshot,
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
  SuperadminAnswerRegradeCommandInput,
  SuperadminAnswerRegradeSelection,
  SuperadminApplyAnswerRegradeInput,
} from "@/application/ports/superadmin-attempt-commands";
import type { AnswerReceiptId } from "@/types/domain/identifiers";
import { getSupabaseDatabaseUrl } from "@/infrastructure/supabase/platform/databaseUrl";
import { AttemptCommandError } from "@/application/errors/attempts";
import { isAttemptErrorCode } from "@/lib/competitiveErrors";
import type { AttemptErrorCode } from "@/types/contracts/competitive-errors";
import {
  attemptSqlDecoders,
  decodeRecordedEvaluation,
  decodeEvaluationContext,
  decodeAttemptAnswerRegradeContext,
  decodeRegradeAnswerResult,
  type AttemptAnswerRegradeContext,
  type AttemptSqlCommandMap,
  type SqlDecoderContext,
  decodeAttemptItemValidationContext,
} from "./attemptCommandContracts";
import {
  CompetitiveResponseContractError,
  fields,
  identity as responseIdentity,
  integer,
  record,
  requireResponse,
} from "@/lib/competitiveResponseContract";
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
  if (error instanceof CompetitiveResponseContractError)
    return new AttemptCommandError("invalid_backend_response", error);
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

export async function purgeTerminalAttempt(
  identity: VerifiedAuthIdentity,
  input: import("@/application/ports/superadmin-attempt-commands").PurgeTerminalAttemptInput,
) {
  return transaction(identity, async (client) => {
    const result = await client.query<{ room_slug: string }>(
      "select private.purge_terminal_attempt($1::jsonb) as room_slug",
      [JSON.stringify(input)],
    );
    const roomSlug = result.rows[0]?.room_slug;
    requireResponse(typeof roomSlug === "string" && roomSlug.length > 0, "purge.roomSlug");
    return roomSlug;
  });
}

export async function readAttemptAnswerRegradeContext(
  identity: VerifiedAuthIdentity,
  {
    attemptId,
    challengeItemId,
    rubricQuestionVersionId,
    lockVersion,
  }: SuperadminAnswerRegradeSelection,
) {
  return transaction(identity, async (client) => {
    const result = await client.query<{ context: unknown }>(
      "select private.read_attempt_answer_regrade_context($1::jsonb) as context",
      [JSON.stringify({ attemptId, challengeItemId, rubricQuestionVersionId, lockVersion })],
    );
    return decodeAttemptAnswerRegradeContext(result.rows[0]?.context);
  });
}

export function confirmAttemptAnswerRegrade(
  identity: VerifiedAuthIdentity,
  input: SuperadminApplyAnswerRegradeInput,
  evaluate: (
    context: AttemptAnswerRegradeContext,
  ) => Pick<SuperadminAnswerRegradeCommandInput, "resultStatus" | "resultPoints" | "resultDetails">,
) {
  return transaction(identity, async (client) => {
    const preparation = await client.query<{ preparation: unknown }>(
      "select private.prepare_attempt_answer_regrade($1::jsonb) as preparation",
      [JSON.stringify(input)],
    );
    const prepared = record(preparation.rows[0]?.preparation, "regrade.preparation");
    if ("result" in prepared) return decodeRegradeAnswerResult(prepared.result, input);

    const context = decodeAttemptAnswerRegradeContext(prepared.context);
    const evaluation = evaluate(context);
    const result = await client.query<{ result: unknown }>(
      "select private.regrade_answer($1::jsonb) as result",
      [JSON.stringify({ ...input, ...evaluation })],
    );
    return decodeRegradeAnswerResult(result.rows[0]?.result, input);
  });
}

export async function callAttemptCommand<K extends keyof AttemptSqlCommandMap>(
  identity: VerifiedAuthIdentity,
  functionName: K,
  input: AttemptSqlCommandMap[K]["input"],
  enrich?: (
    value: AttemptSqlCommandMap[K]["result"],
    client: PoolClient,
  ) => AttemptSqlCommandMap[K]["result"] | Promise<AttemptSqlCommandMap[K]["result"]>,
): Promise<AttemptSqlCommandMap[K]["result"]> {
  return transaction(identity, async (client) => {
    if ("attemptId" in input && typeof input.attemptId === "string" && input.attemptId.length > 0) {
      await expireStaleAttempt(client, input.attemptId);
    }
    const result = await client.query<{ result: unknown }>(
      `select private.${functionName}($1::jsonb) as result`,
      [JSON.stringify(input)],
    );
    const response = await refreshTimeTrialReference(client, result.rows[0]?.result);
    const context = await readSqlDecoderContext(client, functionName, response, input);
    const decoded = attemptSqlDecoders[functionName](response, input, ...context);
    return enrich ? enrich(decoded, client) : decoded;
  });
}

/** The SQL command has authorized and locked the attempt before this scoped read. */
async function readSqlDecoderContext<K extends keyof AttemptSqlCommandMap>(
  client: PoolClient,
  name: K,
  response: unknown,
  input: object,
): Promise<SqlDecoderContext<K>> {
  if (name !== "prepare_interaction" && name !== "submit_word_hashtag_swap")
    return [] as SqlDecoderContext<K>;
  const row = record(response);
  responseIdentity(row, input);
  fields(row, { challengeItemId: (v) => typeof v === "string" && v.length > 0 });
  const result = await client.query<{ context: unknown }>(
    `
    select jsonb_build_object(
      'challengeItemId', i.id, 'questionType', q.type,
      'payloadSchemaVersion', q.payload_schema_version, 'timeLimitMs', q.time_limit_ms,
      'points', i.points, 'mode', cv.mode, 'globalTimeLimitMs', cv.global_time_limit_ms,
      'publicPayload', q.public_payload
    ) as context
    from public.attempts a
    join private.challenge_versions cv on cv.id = a.challenge_version_id
    join private.challenge_items i on i.challenge_version_id = cv.id and i.id = $2::uuid
    join private.question_versions q on q.id = i.question_version_id
    where a.id = $1::uuid`,
    [row.attemptId, row.challengeItemId],
  );
  const context = decodeAttemptItemValidationContext(result.rows[0]?.context);
  return [context] as SqlDecoderContext<K>;
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
  const expired = record(result.rows[0]?.result);
  fields(expired, { abandonedAttempts: integer }, "expireStaleAttempt");
  if (Number(expired.abandonedAttempts) > 0) {
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
  | "saveConnectPairsDraft"
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
    return transaction(this.identity, async (client) => {
      const response = await client.query<{ result: unknown }>(
        "select private.issue_attempt_start($1::uuid, $2::uuid, $3::text, $4::text) as result",
        [
          input.scheduledChallengeId,
          input.expectedAttemptId ?? null,
          input.freshToken,
          input.previousToken ?? null,
        ],
      );
      const result = record(response.rows[0]?.result);
      requireResponse(
        typeof result.preparationId === "string" && typeof result.usePreviousToken === "boolean",
        "prepareSession.preparation",
      );
      return { preparationId: result.preparationId, usePreviousToken: result.usePreviousToken };
    });
  }

  readCompletedAttempt(attemptId: string) {
    return transaction(this.identity, async (client) => {
      const response = await client.query<{
        result: unknown;
      }>("select private.read_completed_attempt($1::uuid) as result", [attemptId]);
      const saved = decodeSavedAttemptResult(response.rows[0]?.result);
      if (saved) responseIdentity(record(saved.result), { attemptId });
      return saved;
    });
  }

  readRecordedEvaluation(receiptId: AnswerReceiptId, sessionToken: string) {
    return transaction(this.identity, async (client) => {
      const response = await client.query<{ result: unknown }>(
        "select private.read_recorded_evaluation($1::uuid, $2::text) as result",
        [receiptId, sessionToken],
      );
      return decodeRecordedEvaluation(response.rows[0]?.result, receiptId);
    });
  }

  readAbandonedAttempt(attemptId: string) {
    return transaction(this.identity, async (client) => {
      const response = await client.query<{
        result: unknown;
      }>("select private.read_abandoned_attempt($1::uuid) as result", [attemptId]);
      const saved = decodeSavedAbandonedAttemptResult(response.rows[0]?.result);
      if (saved) responseIdentity(record(saved.result), { attemptId });
      return saved;
    });
  }
  start(input: StartAttemptCommand) {
    return callAttemptCommand(this.identity, "start_prepared_attempt", input);
  }

  takeOver(input: TakeOverAttemptCommand) {
    return callAttemptCommand(this.identity, "take_over_attempt", input);
  }

  async prepare(input: Parameters<AttemptCommands["prepare"]>[0]) {
    return callAttemptCommand(
      this.identity,
      "prepare_interaction",
      input,
      async (value, client) => {
        const prepared = value;
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
        requireResponse(typeof principal === "string", "response.answerLength.source");
        return { ...prepared, answerLength: countAlphabetAnswerCharacters(principal) || null };
      },
    );
  }

  activate(input: Parameters<AttemptCommands["activate"]>[0]) {
    return callAttemptCommand(this.identity, "activate_interaction", input);
  }

  receiveAnswer(input: SubmitAnswerInput) {
    return callAttemptCommand(this.identity, "receive_answer", input);
  }

  pass(input: Parameters<AttemptCommands["pass"]>[0]) {
    return callAttemptCommand(this.identity, "pass_interaction", input);
  }

  submitMiniWordleGuess(input: Parameters<AttemptCommands["submitMiniWordleGuess"]>[0]) {
    return callAttemptCommand(this.identity, "submit_mini_wordle_guess", input);
  }

  submitWordSearchSelection(input: Parameters<AttemptCommands["submitWordSearchSelection"]>[0]) {
    return callAttemptCommand(this.identity, "submit_word_search_selection", input);
  }

  submitWordHashtagSwap(input: Parameters<AttemptCommands["submitWordHashtagSwap"]>[0]) {
    return callAttemptCommand(this.identity, "submit_word_hashtag_swap", input);
  }

  submitLogicCodeAttempt(input: Parameters<AttemptCommands["submitLogicCodeAttempt"]>[0]) {
    return callAttemptCommand(this.identity, "submit_logic_code_attempt", input);
  }

  submitQueensPlacement(input: Parameters<AttemptCommands["submitQueensPlacement"]>[0]) {
    return callAttemptCommand(this.identity, "submit_queens_placement", input);
  }

  saveQueensDraft(input: Parameters<AttemptCommands["saveQueensDraft"]>[0]) {
    return callAttemptCommand(this.identity, "save_queens_draft", input);
  }

  saveConnectPairsDraft(input: Parameters<AttemptCommands["saveConnectPairsDraft"]>[0]) {
    return callAttemptCommand(this.identity, "save_connect_pairs_draft", input);
  }

  validateQueensBoard(input: Parameters<AttemptCommands["validateQueensBoard"]>[0]) {
    return callAttemptCommand(this.identity, "submit_queens_answer", input);
  }

  revealProgressiveClue(input: Parameters<AttemptCommands["revealProgressiveClue"]>[0]) {
    return callAttemptCommand(this.identity, "reveal_progressive_clue", input);
  }

  readEvaluationContext(receiptId: AnswerReceiptId, sessionToken: string) {
    return transaction<EvaluationContext>(this.identity, async (client) => {
      const result = await client.query<{ read_evaluation_context: unknown }>(
        "select private.read_evaluation_context($1::uuid, $2::text)",
        [receiptId, sessionToken],
      );
      return decodeEvaluationContext(result.rows[0]?.read_evaluation_context, receiptId);
    });
  }

  recordEvaluation(input: RecordEvaluationCommand) {
    return callAttemptCommand(this.identity, "record_evaluation", input);
  }

  async abandon(input: Parameters<AttemptCommands["abandon"]>[0]) {
    return callAttemptCommand(this.identity, "abandon_attempt", input);
  }

  recover(input: RecoverAttemptCommand) {
    return callAttemptCommand(this.identity, "recover_attempt", input);
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
      const snapshot = decodeAttemptRecoverySnapshot(result.rows[0]?.read_attempt_recovery);
      responseIdentity(record(snapshot), { attemptId });
      return snapshot;
    });
  }

  completeFromPersistedAnswers(
    input: Parameters<AttemptCommands["completeFromPersistedAnswers"]>[0],
  ) {
    return callAttemptCommand(this.identity, "complete_attempt", input);
  }
}
