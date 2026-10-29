import { resultDetails } from "@/lib/competitiveResponseContract";
import { alphabetProgress } from "@/lib/competitiveResponseContract";
import { preparedProgress } from "@/lib/competitiveResponseContract";
import { checkedTimeTrial } from "@/lib/competitiveResponseContract";
import type { AttemptCommands, EvaluationContext } from "@/application/ports/attempt-commands";
import type { SuperadminAttemptCommands } from "@/application/ports/superadmin-attempt-commands";
import { readTimeTrialProgress } from "@/lib/timeTrial";
import { isCompetitiveQuestionType } from "@/lib/question-formats/definitions";
import { FORMAT_PUBLIC_VALIDATORS } from "@/lib/question-formats/publicRegistry";
import { STORED_PUBLIC_VALIDATORS } from "@/lib/question-formats/storedPublicRegistry";
import {
  answerStatus,
  boolean,
  date,
  fields,
  formatFields,
  identity,
  integer,
  isRecord,
  json,
  list,
  mode,
  nullable,
  oneOf,
  optionalFields,
  points,
  positive,
  record,
  requireResponse,
  text,
  wordHashtagState,
  timeTrialState,
} from "@/lib/competitiveResponseContract";
import { decodeFinishAttemptResult } from "./attemptLifecycleContracts";

type Methods = {
  start_attempt: AttemptCommands["start"];
  take_over_attempt: AttemptCommands["takeOver"];
  prepare_interaction: AttemptCommands["prepare"];
  activate_interaction: AttemptCommands["activate"];
  receive_answer: AttemptCommands["receiveAnswer"];
  pass_interaction: AttemptCommands["pass"];
  record_evaluation: AttemptCommands["recordEvaluation"];
  recover_attempt: AttemptCommands["recover"];
  complete_attempt: AttemptCommands["completeFromPersistedAnswers"];
  abandon_attempt: AttemptCommands["abandon"];
  submit_mini_wordle_guess: AttemptCommands["submitMiniWordleGuess"];
  submit_logic_code_attempt: AttemptCommands["submitLogicCodeAttempt"];
  submit_word_hashtag_swap: AttemptCommands["submitWordHashtagSwap"];
  submit_word_search_selection: AttemptCommands["submitWordSearchSelection"];
  submit_queens_placement: AttemptCommands["submitQueensPlacement"];
  save_queens_draft: AttemptCommands["saveQueensDraft"];
  submit_queens_answer: AttemptCommands["validateQueensBoard"];
  reveal_progressive_clue: AttemptCommands["revealProgressiveClue"];
  adjust_result: SuperadminAttemptCommands["adjust"];
  invalidate_attempt: SuperadminAttemptCommands["invalidate"];
};
export type AttemptSqlCommandMap = {
  [K in keyof Methods]: {
    input: Parameters<Methods[K]>[0];
    result: Awaited<ReturnType<Methods[K]>>;
  };
};
/** Loaded by the adapter from the authorized attempt's immutable content version. */
export type AttemptItemValidationContext = {
  readonly challengeItemId: string;
  readonly questionType: string;
  readonly payloadSchemaVersion: number;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly mode: import("@/types/domain/content").GameMode;
  readonly globalTimeLimitMs: number | null;
  readonly publicPayload: Record<string, unknown>;
};
export function decodeAttemptItemValidationContext(value: unknown): AttemptItemValidationContext {
  const r = record(value, "context.item");
  fields(
    r,
    {
      challengeItemId: text,
      questionType: (v) => typeof v === "string" && isCompetitiveQuestionType(v),
      payloadSchemaVersion: positive,
      timeLimitMs: positive,
      points,
      mode,
      globalTimeLimitMs: nullable(positive),
      publicPayload: isRecord,
    },
    "context.item",
  );
  return r as AttemptItemValidationContext;
}
export type SqlDecoderContext<K extends keyof Methods> = K extends
  "prepare_interaction" | "submit_word_hashtag_swap"
  ? [context: AttemptItemValidationContext]
  : [];
type Decoder<K extends keyof Methods> = (
  value: unknown,
  input: AttemptSqlCommandMap[K]["input"],
  ...context: SqlDecoderContext<K>
) => AttemptSqlCommandMap[K]["result"];
function decode<K extends keyof Methods>(
  _name: K,
  checks: (row: Record<string, unknown>, context?: AttemptItemValidationContext) => void,
): Decoder<K> {
  return (value, input, ...context) => {
    const row = record(value);
    identity(row, input);
    checks(row, context[0]);
    optionalFields(row, { details: resultDetails });
    if (row.timeTrial != null) checkedTimeTrial(readTimeTrialProgress, row.timeTrial);
    // The sole DTO assertion follows the command's mandatory runtime decoder.
    return row as AttemptSqlCommandMap[K]["result"];
  };
}
const format = (op: string) => (row: Record<string, unknown>) => {
  fields(row, { challengeItemId: text });
  formatFields(op, row, false);
};
export const attemptSqlDecoders: { [K in keyof Methods]: Decoder<K> } = {
  start_attempt: decode("start_attempt", (r) =>
    fields(r, {
      sessionId: text,
      resumed: boolean,
      controlRequired: boolean,
      deadlineAt: nullable(date),
    }),
  ),
  take_over_attempt: decode("take_over_attempt", (r) =>
    fields(r, { sessionId: text, transferred: oneOf(true), deadlineAt: nullable(date) }),
  ),
  prepare_interaction: decode("prepare_interaction", (r, context) => {
    requireResponse(context, "context.item");
    fields(r, {
      challengeItemId: text,
      questionType: (v) => typeof v === "string" && isCompetitiveQuestionType(v),
      payloadSchemaVersion: positive,
      publicPayload: nullable(isRecord),
      presentedAt: nullable(date),
      deadlineAt: nullable(date),
      timedOut: boolean,
    });
    requireResponse((r.presentedAt === null) === (r.deadlineAt === null), "response.deadlineAt");
    if (r.presentedAt !== null)
      requireResponse(
        Date.parse(String(r.deadlineAt)) >= Date.parse(String(r.presentedAt)),
        "response.deadlineAt",
      );
    requireResponse(r.publicPayload !== null || r.timedOut === true, "response.publicPayload");
    optionalFields(r, { progress: nullable(isRecord), answerLength: nullable(positive) });
    requireResponse(
      r.challengeItemId === context.challengeItemId &&
        r.questionType === context.questionType &&
        r.payloadSchemaVersion === context.payloadSchemaVersion,
      "response.questionType",
    );
    preparedProgress(String(r.questionType), r.progress);
    if (r.questionType === "word-hashtag")
      wordHashtagState(r.progress, Number(context.publicPayload.maxMoves));
    if (context.mode === "time-trial") {
      requireResponse(positive(context.globalTimeLimitMs), "context.globalTimeLimitMs");
      timeTrialState(r, { timeLimitMs: context.globalTimeLimitMs! }, "running");
    }
    if (isRecord(r.progress) && r.progress.kind === "alphabet") alphabetProgress(r.progress);
    if (r.publicPayload !== null) {
      const type = r.questionType as keyof typeof FORMAT_PUBLIC_VALIDATORS;
      // Asset IDs have not been resolved yet. Validate their stored representation.
      const payload = r.publicPayload as Record<string, unknown>;
      const hasAsset = (value: unknown): boolean =>
        isRecord(value)
          ? Object.hasOwn(value, "assetId") || Object.values(value).some(hasAsset)
          : Array.isArray(value) && value.some(hasAsset);
      const hasStoredAssets = hasAsset(payload);
      const validation = hasStoredAssets
        ? STORED_PUBLIC_VALIDATORS[type](payload, {
            payloadSchemaVersion: Number(r.payloadSchemaVersion),
            timeLimitMs: context.timeLimitMs,
            publicRepresentation: "stored",
            profile: "published",
          })
        : FORMAT_PUBLIC_VALIDATORS[type]({
            id: String(r.challengeItemId),
            payload,
            progress: r.progress,
            payloadSchemaVersion: Number(r.payloadSchemaVersion),
            timeLimitMs: context.timeLimitMs,
            points: context.points,
            mode: context.mode,
          });
      requireResponse(validation.ok, "response.publicPayload");
    }
  }),
  activate_interaction: decode("activate_interaction", (r) => {
    fields(r, { challengeItemId: text, presentedAt: date, deadlineAt: date, timedOut: boolean });
    requireResponse(
      Date.parse(String(r.deadlineAt)) >= Date.parse(String(r.presentedAt)),
      "response.deadlineAt",
    );
  }),
  receive_answer: decode("receive_answer", (r) =>
    fields(r, {
      receiptId: text,
      timedOut: boolean,
      timeUsedMs: integer,
      receivedAt: date,
      presentedAt: date,
    }),
  ),
  pass_interaction: decode("pass_interaction", (r) => fields(r, { passed: oneOf(true) })),
  record_evaluation: decode("record_evaluation", (r) =>
    fields(r, { receiptId: text, status: answerStatus, points }),
  ),
  recover_attempt: decode("recover_attempt", (r) => {
    fields(r, { receiptId: nullable(text), recovered: boolean });
    optionalFields(r, { preserved: boolean });
  }),
  complete_attempt: (v, i) => {
    const r = decodeFinishAttemptResult(v);
    identity(record(r), i);
    return r;
  },
  abandon_attempt: (v, i) => {
    const r = decodeFinishAttemptResult(v);
    identity(record(r), i);
    return r;
  },
  submit_mini_wordle_guess: decode("submit_mini_wordle_guess", (r) => {
    format("miniWordleGuess")(r);
    fields(r, { sequence: positive, maxAttempts: positive });
  }),
  submit_logic_code_attempt: decode("submit_logic_code_attempt", (r) => {
    format("logicCodeAttempt")(r);
    fields(r, { sequence: positive });
  }),
  submit_word_hashtag_swap: decode("submit_word_hashtag_swap", (r, context) => {
    requireResponse(
      context &&
        context.questionType === "word-hashtag" &&
        r.challengeItemId === context.challengeItemId,
      "context.item",
    );
    format("wordHashtagSwap")(r);
    wordHashtagState(r, Number(context.publicPayload.maxMoves));
  }),
  submit_word_search_selection: decode(
    "submit_word_search_selection",
    format("wordSearchSelection"),
  ),
  submit_queens_placement: decode("submit_queens_placement", format("queensPlacement")),
  save_queens_draft: decode("save_queens_draft", format("queensDraft")),
  submit_queens_answer: decode("submit_queens_answer", format("queensValidation")),
  reveal_progressive_clue: decode("reveal_progressive_clue", (r) => {
    format("progressiveClueReveal")(r);
    fields(r, { clueIndex: integer });
  }),
  adjust_result: decode("adjust_result", (r) =>
    fields(r, { status: oneOf("completed", "abandoned", "invalidated"), effectiveScore: points }),
  ),
  invalidate_attempt: decode("invalidate_attempt", (r) =>
    fields(r, { status: oneOf("completed", "abandoned", "invalidated"), effectiveScore: points }),
  ),
};
export function decodeRecordedEvaluation(value: unknown, receiptId: string) {
  if (value === null) return null;
  const r = record(value);
  identity(r, { receiptId });
  fields(r, { receiptId: text, status: answerStatus, points });
  optionalFields(r, { details: resultDetails });
  return r as Awaited<ReturnType<AttemptCommands["recordEvaluation"]>>;
}
export function decodeEvaluationContext(value: unknown, receiptId: string): EvaluationContext {
  const r = record(value);
  fields(r, {
    receiptId: text,
    questionVersionId: text,
    questionType: (v) => typeof v === "string" && isCompetitiveQuestionType(v),
    payloadSchemaVersion: positive,
    itemConfigSchemaVersion: positive,
    publicPayload: json,
    solutionPayload: json,
    timeLimitMs: positive,
    itemPoints: points,
    itemConfig: json,
    mode,
    modeConfigSchemaVersion: positive,
    modeConfig: json,
    answer: json,
    receivedAt: date,
    timeUsedMs: integer,
    timedOut: boolean,
  });
  requireResponse(r.receiptId === receiptId, "response.receiptId");
  optionalFields(r, {
    submittedCodes: nullable(list(text)),
    incorrectAttempts: nullable(integer),
    incorrectValidations: nullable(integer),
    matchingIncorrectAttempts: nullable(integer),
    progressiveCluesRevealed: nullable(integer),
    progressiveClueAvailablePoints: nullable(points),
  });
  return Object.fromEntries(
    Object.entries(r).filter(
      ([key, value]) =>
        value !== null ||
        ![
          "submittedCodes",
          "incorrectAttempts",
          "incorrectValidations",
          "matchingIncorrectAttempts",
          "progressiveCluesRevealed",
          "progressiveClueAvailablePoints",
        ].includes(key),
    ),
  ) as EvaluationContext;
}
