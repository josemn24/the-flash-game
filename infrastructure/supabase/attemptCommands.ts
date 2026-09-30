import "server-only";

import { Pool, type PoolClient } from "pg";
import type {
  AttemptCommands,
  CompleteAttemptCommand,
  EvaluationContext,
  RecordEvaluationCommand,
  RecoverAttemptCommand,
  StartAttemptCommand,
} from "@/application/ports/attempt-commands";
import type {
  ActivateInteractionResult,
  PrepareInteractionResult,
  ReceiveAnswerResult,
  StartAttemptResult,
  SubmitAnswerInput,
  SubmitAnswerResult,
  FinishAttemptResult,
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
import type { AnswerValue } from "@/types/contracts";
import type { AnswerReceiptId } from "@/types/domain/identifiers";
import { evaluateCompetitiveReceipt } from "@/server/evaluation/evaluate-receipt";
import { resolveCompetitiveQuestion } from "@/server/evaluation/resolve-competitive-question";
import { resolveCompetitiveQuestionPayload } from "@/infrastructure/supabase/questionAssetRuntime";
import { getSupabaseDatabaseUrl } from "@/infrastructure/supabase/databaseUrl";
import { AttemptCommandError } from "@/infrastructure/supabase/attemptCommandError";
import { normalizeCompetitiveEvaluationContext } from "@/infrastructure/supabase/normalize-competitive-context";

export { AttemptCommandError } from "@/infrastructure/supabase/attemptCommandError";

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

function commandCode(error: unknown) {
  const infrastructureCode =
    error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  if (
    infrastructureCode.startsWith("08") ||
    ["28P01", "28000", "42501"].includes(infrastructureCode) ||
    ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EPIPE"].includes(infrastructureCode) ||
    /connection|timeout|socket/i.test(message)
  ) {
    return "database_unavailable";
  }
  const known = [
    "not_authorized",
    "competitive_access_denied",
    "session_revoked",
    "stale_version",
    "idempotency_conflict",
    "invalid_command",
    "attempt_terminal",
    "interaction_not_presented",
    "evaluation_pending",
    "publication_cancelled",
    "attempt_not_terminal",
    "reason_required",
    "invalid_score",
    "not_competitive",
    "incomplete_challenge",
    "unfinished_interaction",
    "no_evaluated_answers",
    "no_pending_item",
    "deadline_reached",
    "receipt_not_found",
    "already_evaluated",
    "takeover_disabled",
    "attempt_inactivity_expired",
    "recovery_required",
    "invalid_mini_wordle_guess",
    "duplicate_mini_wordle_guess",
    "mini_wordle_requires_guess_command",
    "invalid_logic_code",
    "duplicate_logic_code",
    "logic_code_requires_attempt_command",
    "invalid_matching_answer",
    "invalid_word_search_selection",
    "word_search_target_already_found",
    "word_search_requires_selection_command",
    "invalid_word_hashtag_swap",
    "word_hashtag_moves_exhausted",
    "word_hashtag_requires_swap_command",
    "invalid_queens_placement",
    "invalid_queens_answer",
    "queens_answer_incomplete",
    "queens_requires_placement_command",
    "prefilled_queen_locked",
    "all_clues_revealed",
    "progressive_clues_requires_reveal_command",
    "unsupported_question",
    "invalid_question_payload",
  ];
  return known.find((candidate) => message.includes(candidate)) ?? "command_failed";
}

async function transaction<T>(
  identity: VerifiedAuthIdentity,
  run: (client: PoolClient) => Promise<T>,
) {
  const client = await getPool().connect();
  try {
    await beginAsServiceRole(client, identity);
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original database error is the useful one for the API mapper.
    }
    throw new AttemptCommandError(commandCode(error), error);
  } finally {
    client.release();
  }
}

export async function callAttemptCommand<T>(
  identity: VerifiedAuthIdentity,
  functionName: string,
  input: object,
): Promise<T> {
  return transaction(identity, async (client) => {
    if ("attemptId" in input && typeof input.attemptId === "string" && input.attemptId.length > 0) {
      await expireStaleAttempt(client, input.attemptId);
    }
    const result = await client.query<{ result: T }>(
      `select private.${functionName}($1::jsonb) as result`,
      [JSON.stringify(input)],
    );
    return result.rows[0]?.result as T;
  });
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

function resolveCompetitiveEvaluationQuestion(context: EvaluationContext) {
  return resolveCompetitiveQuestion(normalizeCompetitiveEvaluationContext(context));
}

export class SupabaseAttemptCommands implements Pick<
  AttemptCommands,
  | "start"
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
  | "complete"
  | "abandon"
  | "recover"
  | "readRecovery"
> {
  constructor(private readonly identity: VerifiedAuthIdentity) {}

  start(input: StartAttemptCommand) {
    return callAttemptCommand<StartAttemptResult>(this.identity, "start_attempt", input);
  }

  async prepare(input: Parameters<AttemptCommands["prepare"]>[0]) {
    const prepared = await callAttemptCommand<PrepareInteractionResult>(
      this.identity,
      "prepare_interaction",
      input,
    );
    if (!prepared.publicPayload) return prepared;
    return {
      ...prepared,
      publicPayload: (await resolveCompetitiveQuestionPayload({
        authUserId: this.identity.authUserId,
        attemptId: input.attemptId,
        publicPayload: prepared.publicPayload,
      })) as PrepareInteractionResult["publicPayload"],
    };
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

  async submitMiniWordleGuess(input: Parameters<AttemptCommands["submitMiniWordleGuess"]>[0]) {
    const accepted = await callAttemptCommand<SubmitMiniWordleGuessResult>(
      this.identity,
      "submit_mini_wordle_guess",
      input,
    );
    if (!accepted.terminal || !accepted.receiptId) return accepted;
    const evaluated = await this.evaluateReceipt({
      attemptId: input.attemptId,
      sessionToken: input.sessionToken,
      lockVersion: accepted.lockVersion,
      receiptId: accepted.receiptId,
      idempotencyKey: `evaluation:${accepted.receiptId}`,
    });
    return {
      ...accepted,
      lockVersion: evaluated.lockVersion,
      status: evaluated.status,
      points: evaluated.points,
    };
  }

  async submitWordSearchSelection(
    input: Parameters<AttemptCommands["submitWordSearchSelection"]>[0],
  ) {
    const accepted = await callAttemptCommand<SubmitWordSearchSelectionResult>(
      this.identity,
      "submit_word_search_selection",
      input,
    );
    if (!accepted.terminal || !accepted.receiptId) return accepted;
    const evaluated = await this.evaluateReceipt({
      attemptId: input.attemptId,
      sessionToken: input.sessionToken,
      lockVersion: accepted.lockVersion,
      receiptId: accepted.receiptId,
      idempotencyKey: `evaluation:${accepted.receiptId}`,
    });
    return {
      ...accepted,
      lockVersion: evaluated.lockVersion,
      status: evaluated.status,
      points: evaluated.points,
    };
  }

  async submitWordHashtagSwap(input: Parameters<AttemptCommands["submitWordHashtagSwap"]>[0]) {
    const accepted = await callAttemptCommand<SubmitWordHashtagSwapResult>(
      this.identity,
      "submit_word_hashtag_swap",
      input,
    );
    if (!accepted.terminal || !accepted.receiptId) return accepted;
    const evaluated = await this.evaluateReceipt({
      attemptId: input.attemptId,
      sessionToken: input.sessionToken,
      lockVersion: accepted.lockVersion,
      receiptId: accepted.receiptId,
      idempotencyKey: `evaluation:${accepted.receiptId}`,
    });
    return {
      ...accepted,
      lockVersion: evaluated.lockVersion,
      status: evaluated.status,
      points: evaluated.points,
      details: evaluated.details,
    };
  }

  async submitLogicCodeAttempt(input: Parameters<AttemptCommands["submitLogicCodeAttempt"]>[0]) {
    const accepted = await callAttemptCommand<SubmitLogicCodeAttemptResult>(
      this.identity,
      "submit_logic_code_attempt",
      input,
    );
    if (!accepted.terminal || !accepted.receiptId) return accepted;
    const evaluated = await this.evaluateReceipt({
      attemptId: input.attemptId,
      sessionToken: input.sessionToken,
      lockVersion: accepted.lockVersion,
      receiptId: accepted.receiptId,
      idempotencyKey: `evaluation:${accepted.receiptId}`,
    });
    return {
      ...accepted,
      lockVersion: evaluated.lockVersion,
      status: evaluated.status,
      points: evaluated.points,
    };
  }

  async submitQueensPlacement(input: Parameters<AttemptCommands["submitQueensPlacement"]>[0]) {
    const accepted = await callAttemptCommand<SubmitQueensPlacementResult>(
      this.identity,
      "submit_queens_placement",
      input,
    );
    if (!accepted.terminal || !accepted.receiptId) return accepted;
    const evaluated = await this.evaluateReceipt({
      attemptId: input.attemptId,
      sessionToken: input.sessionToken,
      lockVersion: accepted.lockVersion,
      receiptId: accepted.receiptId,
      idempotencyKey: `evaluation:${accepted.receiptId}`,
    });
    return {
      ...accepted,
      lockVersion: evaluated.lockVersion,
      status: evaluated.status,
      points: evaluated.points,
    };
  }

  saveQueensDraft(input: Parameters<AttemptCommands["saveQueensDraft"]>[0]) {
    return callAttemptCommand<SaveQueensDraftResult>(this.identity, "save_queens_draft", input);
  }

  async validateQueensBoard(input: Parameters<AttemptCommands["validateQueensBoard"]>[0]) {
    const accepted = await callAttemptCommand<ValidateQueensBoardResult>(
      this.identity,
      "submit_queens_answer",
      input,
    );
    if (!accepted.terminal || !accepted.receiptId) return accepted;
    const evaluated = await this.evaluateReceipt({
      attemptId: input.attemptId,
      sessionToken: input.sessionToken,
      lockVersion: accepted.lockVersion,
      receiptId: accepted.receiptId,
      idempotencyKey: `evaluation:${accepted.receiptId}`,
    });
    return {
      ...accepted,
      lockVersion: evaluated.lockVersion,
      status: evaluated.status,
      points: evaluated.points,
      details: evaluated.details,
    };
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

  complete(input: CompleteAttemptCommand) {
    return callAttemptCommand<FinishAttemptResult>(this.identity, "complete_attempt", input);
  }

  abandon(input: Parameters<AttemptCommands["abandon"]>[0]) {
    return callAttemptCommand<FinishAttemptResult>(this.identity, "abandon_attempt", input);
  }

  recover(input: RecoverAttemptCommand) {
    return callAttemptCommand<RecoverAttemptResult>(this.identity, "recover_attempt", input);
  }

  readRecovery(attemptId: string, sessionToken: string) {
    return transaction<AttemptRecoverySnapshot>(this.identity, async (client) => {
      await expireStaleAttempt(client, attemptId);
      const result = await client.query<{ read_attempt_recovery: AttemptRecoverySnapshot }>(
        "select private.read_attempt_recovery($1::uuid, $2::text)",
        [attemptId, sessionToken],
      );
      return result.rows[0]?.read_attempt_recovery as AttemptRecoverySnapshot;
    });
  }

  async evaluateAndRecord(input: { readonly receive: SubmitAnswerInput }) {
    const received = await this.receiveAnswer(input.receive);
    const context = await this.readEvaluationContext(
      received.receiptId,
      input.receive.sessionToken,
    );
    const resolvedContext = {
      ...context,
      publicPayload: (await resolveCompetitiveQuestionPayload({
        authUserId: this.identity.authUserId,
        attemptId: input.receive.attemptId,
        publicPayload: context.publicPayload,
      })) as EvaluationContext["publicPayload"],
    };
    const result: Pick<
      ReturnType<typeof evaluateCompetitiveReceipt>,
      "status" | "points" | "details"
    > = resolvedContext.mode === "pyramid" && resolvedContext.answer === null
      ? { status: "unanswered" as const, points: 0 }
      : evaluateCompetitiveReceipt({
          receipt: {
            timeUsedMs: resolvedContext.timeUsedMs,
            timedOut: resolvedContext.timedOut,
          },
          question: resolveCompetitiveEvaluationQuestion(resolvedContext),
          answer: (resolvedContext.answer as AnswerValue | null) ?? null,
          progressiveCluesRevealed: resolvedContext.progressiveCluesRevealed ?? 1,
          progressiveClueAvailablePoints: resolvedContext.progressiveClueAvailablePoints,
          matchingIncorrectAttempts: resolvedContext.matchingIncorrectAttempts ?? 0,
          incorrectAttempts: resolvedContext.incorrectAttempts ?? 0,
        });
    const evaluated = await this.recordEvaluation({
      attemptId: input.receive.attemptId,
      sessionToken: input.receive.sessionToken,
      lockVersion: received.lockVersion,
      idempotencyKey: `evaluation:${received.receiptId}`,
      receiptId: received.receiptId,
      status: result.status,
      points: result.points,
      ...(result.details ? { resultDetails: result.details } : {}),
    });
    return {
      received,
      evaluated: {
        ...evaluated,
        ...(result.details ? { details: result.details } : {}),
      },
    };
  }

  async evaluateReceipt(input: {
    readonly attemptId: string;
    readonly sessionToken: string;
    readonly lockVersion: number;
    readonly receiptId: AnswerReceiptId;
    readonly idempotencyKey: string;
  }) {
    const context = await this.readEvaluationContext(input.receiptId, input.sessionToken);
    const resolvedContext = {
      ...context,
      publicPayload: (await resolveCompetitiveQuestionPayload({
        authUserId: this.identity.authUserId,
        attemptId: input.attemptId,
        publicPayload: context.publicPayload,
      })) as EvaluationContext["publicPayload"],
    };
    const result: Pick<
      ReturnType<typeof evaluateCompetitiveReceipt>,
      "status" | "points" | "details"
    > = resolvedContext.mode === "pyramid" && resolvedContext.answer === null
      ? { status: "unanswered" as const, points: 0 }
      : evaluateCompetitiveReceipt({
          receipt: { timeUsedMs: resolvedContext.timeUsedMs, timedOut: resolvedContext.timedOut },
          question: resolveCompetitiveEvaluationQuestion(resolvedContext),
          answer: (resolvedContext.answer as AnswerValue | null) ?? null,
          progressiveCluesRevealed: resolvedContext.progressiveCluesRevealed ?? 1,
          progressiveClueAvailablePoints: resolvedContext.progressiveClueAvailablePoints,
          matchingIncorrectAttempts: resolvedContext.matchingIncorrectAttempts ?? 0,
          incorrectAttempts: resolvedContext.incorrectAttempts ?? 0,
        });
    const evaluated = await this.recordEvaluation({
      attemptId: input.attemptId as Parameters<AttemptCommands["recordEvaluation"]>[0]["attemptId"],
      sessionToken: input.sessionToken,
      lockVersion: input.lockVersion,
      idempotencyKey: input.idempotencyKey,
      receiptId: input.receiptId,
      status: result.status,
      points: result.points,
      ...(result.details ? { resultDetails: result.details } : {}),
    });
    return { ...evaluated, ...(result.details ? { details: result.details } : {}) };
  }

  completeFromPersistedAnswers(input: {
    readonly attemptId: string;
    readonly sessionToken: string;
    readonly lockVersion: number;
    readonly idempotencyKey: string;
  }) {
    return transaction<FinishAttemptResult>(this.identity, async (client) => {
      await expireStaleAttempt(client, input.attemptId);
      const scoreResult = await client.query<{ score: number }>(
        "select coalesce(sum(points), 0)::integer as score from private.attempt_answers where attempt_id = $1::uuid",
        [input.attemptId],
      );
      const score = scoreResult.rows[0]?.score ?? 0;
      const command = await client.query<{ result: FinishAttemptResult }>(
        "select private.complete_attempt($1::jsonb) as result",
        [
          JSON.stringify({
            ...input,
            score,
          }),
        ],
      );
      return command.rows[0]?.result as FinishAttemptResult;
    });
  }
}
