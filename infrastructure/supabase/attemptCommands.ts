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
  PrepareInteractionResult,
  ReceiveAnswerResult,
  StartAttemptResult,
  SubmitAnswerInput,
  SubmitAnswerResult,
  FinishAttemptResult,
  RecoverAttemptResult,
  AttemptRecoverySnapshot,
} from "@/types/contracts/attempts";
import type { AnswerReceiptId } from "@/types/domain/identifiers";
import type { MultipleChoiceQuestion, Question } from "@/types/game";
import { evaluateReceipt } from "@/server/evaluation/evaluate-receipt";

const poolKey = Symbol.for("the-flash-game.supabase.attempt-pool");
const globalPool = globalThis as typeof globalThis & { [poolKey]?: Pool };

export type VerifiedAuthIdentity = {
  readonly authUserId: string;
};

export class AttemptCommandError extends Error {
  readonly code: string;

  constructor(code: string, cause?: unknown) {
    super(code, { cause });
    this.name = "AttemptCommandError";
    this.code = code;
  }
}

function connectionString() {
  const configured = process.env.SUPABASE_DB_URL;
  if (!configured) {
    throw new AttemptCommandError("database_unavailable");
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch (error) {
    throw new AttemptCommandError("database_unavailable", error);
  }

  // The local Supabase status command emits a postgres URL. The application
  // deliberately changes only the login role; ownership remains with postgres.
  url.username = "authenticator";
  return url.toString();
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
  await client.query("SET LOCAL ROLE service_role");
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: identity.authUserId, role: "authenticated", is_anonymous: false }),
  ]);
}

function commandCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
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
    "incomplete_challenge",
    "unfinished_interaction",
    "no_evaluated_answers",
    "no_pending_item",
    "deadline_reached",
    "receipt_not_found",
    "already_evaluated",
    "takeover_disabled",
    "recovery_required",
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

async function callCommand<T>(
  identity: VerifiedAuthIdentity,
  functionName: string,
  input: object,
): Promise<T> {
  return transaction(identity, async (client) => {
    const result = await client.query<{ result: T }>(
      `select private.${functionName}($1::jsonb) as result`,
      [JSON.stringify(input)],
    );
    return result.rows[0]?.result as T;
  });
}

function asQuestion(context: EvaluationContext): MultipleChoiceQuestion {
  if (
    context.questionType !== "multiple-choice" ||
    context.payloadSchemaVersion !== 1 ||
    context.itemConfigSchemaVersion !== 1 ||
    context.modeConfigSchemaVersion !== 1
  ) {
    throw new AttemptCommandError("unsupported_question");
  }
  if (
    !context.publicPayload ||
    typeof context.publicPayload !== "object" ||
    Array.isArray(context.publicPayload)
  ) {
    throw new AttemptCommandError("invalid_question_payload");
  }
  if (
    !context.solutionPayload ||
    typeof context.solutionPayload !== "object" ||
    Array.isArray(context.solutionPayload)
  ) {
    throw new AttemptCommandError("invalid_question_solution");
  }
  if (
    !context.itemConfig ||
    typeof context.itemConfig !== "object" ||
    Array.isArray(context.itemConfig) ||
    !context.modeConfig ||
    typeof context.modeConfig !== "object" ||
    Array.isArray(context.modeConfig)
  ) {
    throw new AttemptCommandError("invalid_question_config");
  }

  const publicPayload = context.publicPayload as Record<string, unknown>;
  const solutionPayload = context.solutionPayload as Record<string, unknown>;
  const options = publicPayload.options;
  const correctAnswer = solutionPayload.correctAnswer;
  const prompt = publicPayload.question ?? publicPayload.prompt;
  if (
    !Array.isArray(options) ||
    !options.every((option) => typeof option === "string") ||
    typeof correctAnswer !== "string" ||
    !options.includes(correctAnswer) ||
    typeof prompt !== "string"
  ) {
    throw new AttemptCommandError("invalid_question_payload");
  }

  const tags = publicPayload.tags;
  return {
    id: typeof publicPayload.id === "string" ? publicPayload.id : context.receiptId,
    type: "multiple-choice",
    category: typeof publicPayload.category === "string" ? publicPayload.category : "",
    tags:
      tags && typeof tags === "object" && !Array.isArray(tags)
        ? (tags as Question["tags"])
        : {
            domains: [],
            topics: [],
            cognitiveSkills: [],
            formatSkills: [],
            lifeSkills: [],
          },
    question: prompt,
    options,
    correctAnswer,
    timeLimit: context.timeLimitMs / 1000,
    points: context.itemPoints,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    ...(publicPayload.media
      ? { media: publicPayload.media as MultipleChoiceQuestion["media"] }
      : {}),
    ...(publicPayload.promptVisual
      ? { promptVisual: publicPayload.promptVisual as MultipleChoiceQuestion["promptVisual"] }
      : {}),
  };
}

export class SupabaseAttemptCommands implements Pick<
  AttemptCommands,
  | "start"
  | "prepare"
  | "receiveAnswer"
  | "readEvaluationContext"
  | "recordEvaluation"
  | "complete"
  | "abandon"
  | "recover"
  | "readRecovery"
> {
  constructor(private readonly identity: VerifiedAuthIdentity) {}

  start(input: StartAttemptCommand) {
    return callCommand<StartAttemptResult>(this.identity, "start_attempt", input);
  }

  prepare(input: Parameters<AttemptCommands["prepare"]>[0]) {
    return callCommand<PrepareInteractionResult>(this.identity, "prepare_interaction", input);
  }

  receiveAnswer(input: SubmitAnswerInput) {
    return callCommand<ReceiveAnswerResult>(this.identity, "receive_answer", input);
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
    return callCommand<SubmitAnswerResult>(this.identity, "record_evaluation", input);
  }

  complete(input: CompleteAttemptCommand) {
    return callCommand<FinishAttemptResult>(this.identity, "complete_attempt", input);
  }

  abandon(input: Parameters<AttemptCommands["abandon"]>[0]) {
    return callCommand<FinishAttemptResult>(this.identity, "abandon_attempt", input);
  }

  recover(input: RecoverAttemptCommand) {
    return callCommand<RecoverAttemptResult>(this.identity, "recover_attempt", input);
  }

  readRecovery(attemptId: string, sessionToken: string) {
    return transaction<AttemptRecoverySnapshot>(this.identity, async (client) => {
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
    const result = evaluateReceipt({
      receipt: {
        timeUsedMs: context.timeUsedMs,
        timedOut: context.timedOut,
      },
      question: asQuestion(context),
      answer: typeof context.answer === "string" ? context.answer : null,
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
    return { received, evaluated };
  }

  async evaluateReceipt(input: {
    readonly attemptId: string;
    readonly sessionToken: string;
    readonly lockVersion: number;
    readonly receiptId: AnswerReceiptId;
    readonly idempotencyKey: string;
  }) {
    const context = await this.readEvaluationContext(input.receiptId, input.sessionToken);
    const result = evaluateReceipt({
      receipt: { timeUsedMs: context.timeUsedMs, timedOut: context.timedOut },
      question: asQuestion(context),
      answer: typeof context.answer === "string" ? context.answer : null,
    });
    return this.recordEvaluation({
      attemptId: input.attemptId as Parameters<AttemptCommands["recordEvaluation"]>[0]["attemptId"],
      sessionToken: input.sessionToken,
      lockVersion: input.lockVersion,
      idempotencyKey: input.idempotencyKey,
      receiptId: input.receiptId,
      status: result.status,
      points: result.points,
      ...(result.details ? { resultDetails: result.details } : {}),
    });
  }

  completeFromPersistedAnswers(input: {
    readonly attemptId: string;
    readonly sessionToken: string;
    readonly lockVersion: number;
    readonly idempotencyKey: string;
  }) {
    return transaction<FinishAttemptResult>(this.identity, async (client) => {
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
