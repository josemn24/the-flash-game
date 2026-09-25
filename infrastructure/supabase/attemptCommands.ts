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
  SubmitMiniWordleGuessResult,
  SubmitMatchingPairResult,
  SubmitWordSearchSelectionResult,
  SubmitWordHashtagSwapResult,
  SubmitLogicCodeAttemptResult,
  SubmitQueensPlacementResult,
  RevealProgressiveClueResult,
  PassInteractionResult,
} from "@/types/contracts/attempts";
import type { AnswerReceiptId } from "@/types/domain/identifiers";
import type {
  AnswerValue,
  ConnectPairsQuestion,
  LogicCodeQuestion,
  LogicMatrixQuestion,
  MatchingQuestion,
  MiniWordleQuestion,
  MultipleChoiceQuestion,
  ProgressiveCluesQuestion,
  ProgressiveImageQuestion,
  Question,
  QueensQuestion,
  TrueFalseQuestion,
  OddOneOutQuestion,
  OrderingQuestion,
  AnagramQuestion,
  ClassificationQuestion,
  EstimationQuestion,
  EscapeQuestion,
  HeatMapQuestion,
  ShortTextQuestion,
  WordSearchQuestion,
  WordHashtagQuestion,
  ZipQuestion,
} from "@/types/game";
import {
  isMiniWordleMaxAttempts,
  isMiniWordleWordLength,
  isValidMiniWordleWord,
  normalizeMiniWordleWord,
} from "@/lib/miniWordle";
import { evaluateReceipt } from "@/server/evaluation/evaluate-receipt";
import { resolveCompetitiveQuestionPayload } from "@/infrastructure/supabase/questionAssetRuntime";
import { isValidEstimationConfiguration, isValidEstimationSolution } from "@/lib/estimation";
import { isNormalizedPoint, isValidHeatMapRadii } from "@/lib/heatMap";
import { isValidWordSearchConfiguration } from "@/lib/wordSearch";
import { isValidLogicMatrixPublicPayload } from "@/lib/scoringCore/questions/logicMatrix";
import { isValidZipConfiguration, isValidZipPublicConfiguration } from "@/lib/zip";
import { isValidEscapeConfiguration, isValidEscapePublicConfiguration } from "@/lib/escape";
import { isValidConnectPairsConfiguration } from "@/lib/connectPairs";
import {
  isValidWordHashtagConfiguration,
  isValidWordHashtagPublicConfiguration,
} from "@/lib/wordHashtag";

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
    "incomplete_challenge",
    "unfinished_interaction",
    "no_evaluated_answers",
    "no_pending_item",
    "deadline_reached",
    "receipt_not_found",
    "already_evaluated",
    "takeover_disabled",
    "recovery_required",
    "invalid_mini_wordle_guess",
    "duplicate_mini_wordle_guess",
    "mini_wordle_requires_guess_command",
    "invalid_logic_code",
    "duplicate_logic_code",
    "logic_code_requires_attempt_command",
    "invalid_matching_pair",
    "matching_item_already_resolved",
    "duplicate_matching_pair",
    "matching_requires_pair_command",
    "invalid_word_search_selection",
    "word_search_target_already_found",
    "word_search_requires_selection_command",
    "invalid_word_hashtag_swap",
    "word_hashtag_moves_exhausted",
    "word_hashtag_requires_swap_command",
    "invalid_queens_placement",
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

function asQuestion(
  context: EvaluationContext,
):
  | MultipleChoiceQuestion
  | MiniWordleQuestion
  | LogicCodeQuestion
  | LogicMatrixQuestion
  | ConnectPairsQuestion
  | ProgressiveCluesQuestion
  | ProgressiveImageQuestion
  | MatchingQuestion
  | QueensQuestion
  | TrueFalseQuestion
  | OddOneOutQuestion
  | OrderingQuestion
  | AnagramQuestion
  | ClassificationQuestion
  | EstimationQuestion
  | HeatMapQuestion
  | ShortTextQuestion
  | WordSearchQuestion
  | WordHashtagQuestion
  | ZipQuestion
  | EscapeQuestion {
  if (
    ![
      "multiple-choice",
      "mini-wordle",
      "logic-code",
      "logic-matrix",
      "progressive-clues",
      "matching",
      "progressive-image",
      "queens",
      "true-false",
      "odd-one-out",
      "ordering",
      "anagram",
      "classification",
      "estimation",
      "heat-map",
      "word-search",
      "word-hashtag",
      "zip",
      "escape",
      "connect-pairs",
      "short-text",
    ].includes(context.questionType) ||
    (context.payloadSchemaVersion !== 1 &&
      !(
        (context.questionType === "progressive-image" ||
          context.questionType === "estimation" ||
          context.questionType === "heat-map") &&
        context.payloadSchemaVersion === 2
      )) ||
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
  const prompt = publicPayload.question ?? publicPayload.prompt;
  if (typeof prompt !== "string") {
    throw new AttemptCommandError("invalid_question_payload");
  }

  const tags = publicPayload.tags;
  const base = {
    id: typeof publicPayload.id === "string" ? publicPayload.id : context.receiptId,
    category: typeof publicPayload.category === "string" ? publicPayload.category : "",
    tags:
      tags && typeof tags === "object" && !Array.isArray(tags)
        ? (tags as Question["tags"])
        : { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
    question: prompt,
    timeLimit: context.timeLimitMs / 1000,
    points: context.itemPoints,
  } as const;
  if (context.questionType === "multiple-choice") {
    const options = publicPayload.options;
    const correctAnswer = solutionPayload.correctAnswer;
    if (
      !Array.isArray(options) ||
      !options.every((option) => typeof option === "string") ||
      typeof correctAnswer !== "string" ||
      !options.includes(correctAnswer)
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "multiple-choice",
      options,
      correctAnswer,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
      ...(publicPayload.media
        ? { media: publicPayload.media as MultipleChoiceQuestion["media"] }
        : {}),
      ...(publicPayload.promptVisual
        ? { promptVisual: publicPayload.promptVisual as MultipleChoiceQuestion["promptVisual"] }
        : {}),
    };
  }
  if (context.questionType === "short-text") {
    const correctAnswer = solutionPayload.correctAnswer;
    const acceptedAnswers = solutionPayload.acceptedAnswers;
    if (
      typeof correctAnswer !== "string" ||
      !Array.isArray(acceptedAnswers) ||
      !acceptedAnswers.every((answer) => typeof answer === "string")
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "short-text",
      correctAnswer,
      acceptedAnswers,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies ShortTextQuestion;
  }
  if (context.questionType === "estimation") {
    const configuration = {
      min: publicPayload.min,
      max: publicPayload.max,
      step: publicPayload.step,
      initialValue: publicPayload.initialValue,
      unit: publicPayload.unit,
    };
    const media = publicPayload.media;
    const validMedia =
      media === null ||
      (media &&
        typeof media === "object" &&
        !Array.isArray(media) &&
        (media as Record<string, unknown>).type === "image" &&
        typeof (media as Record<string, unknown>).src === "string" &&
        typeof (media as Record<string, unknown>).alt === "string");
    if (
      !Object.hasOwn(publicPayload, "media") ||
      !isValidEstimationConfiguration(configuration) ||
      !validMedia ||
      !isValidEstimationSolution(
        solutionPayload.correctAnswer,
        solutionPayload.tolerance,
        configuration,
      )
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "estimation",
      min: configuration.min as number,
      max: configuration.max as number,
      step: configuration.step as number,
      initialValue: configuration.initialValue as number,
      unit: configuration.unit as string,
      ...(media ? { media: media as EstimationQuestion["media"] } : {}),
      correctAnswer: solutionPayload.correctAnswer as number,
      tolerance: solutionPayload.tolerance as number,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (context.questionType === "heat-map") {
    const surface = publicPayload.surface;
    const validSurface =
      surface &&
      typeof surface === "object" &&
      !Array.isArray(surface) &&
      typeof (surface as Record<string, unknown>).src === "string" &&
      typeof (surface as Record<string, unknown>).alt === "string" &&
      Number.isSafeInteger((surface as Record<string, unknown>).width) &&
      Number((surface as Record<string, unknown>).width) > 0 &&
      Number((surface as Record<string, unknown>).width) <= 8192 &&
      Number.isSafeInteger((surface as Record<string, unknown>).height) &&
      Number((surface as Record<string, unknown>).height) > 0 &&
      Number((surface as Record<string, unknown>).height) <= 8192 &&
      ((surface as Record<string, unknown>).fit === undefined ||
        (surface as Record<string, unknown>).fit === "cover" ||
        (surface as Record<string, unknown>).fit === "contain") &&
      ((surface as Record<string, unknown>).position === undefined ||
        typeof (surface as Record<string, unknown>).position === "string");
    if (
      !Object.hasOwn(publicPayload, "surface") ||
      typeof publicPayload.targetLabel !== "string" ||
      publicPayload.targetLabel.trim().length === 0 ||
      !validSurface ||
      !isNormalizedPoint(solutionPayload.target) ||
      !isValidHeatMapRadii(solutionPayload.fullCreditRadius, solutionPayload.toleranceRadius)
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "heat-map",
      surface: surface as HeatMapQuestion["surface"],
      targetLabel: publicPayload.targetLabel,
      target: solutionPayload.target,
      fullCreditRadius: solutionPayload.fullCreditRadius as number,
      toleranceRadius: solutionPayload.toleranceRadius as number,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (context.questionType === "true-false") {
    const correctAnswer = solutionPayload.correctAnswer;
    if (typeof correctAnswer !== "boolean") {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "true-false",
      correctAnswer,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (context.questionType === "odd-one-out") {
    const items = publicPayload.items;
    const correctAnswer = solutionPayload.correctAnswer;
    if (
      !Array.isArray(items) ||
      items.length < 3 ||
      items.length > 8 ||
      !items.every((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        const value = item as Record<string, unknown>;
        return (
          !Object.hasOwn(value, "correctAnswer") &&
          !Object.hasOwn(value, "correctMatchId") &&
          typeof value.id === "string" &&
          value.id.trim().length > 0 &&
          value.id.length <= 120 &&
          typeof value.label === "string" &&
          value.label.trim().length > 0 &&
          value.label.length <= 500
        );
      }) ||
      typeof correctAnswer !== "string"
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    const itemIds = items.map((item) => (item as Record<string, unknown>).id as string);
    if (new Set(itemIds).size !== itemIds.length || !itemIds.includes(correctAnswer)) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "odd-one-out",
      items: items as OddOneOutQuestion["items"],
      correctAnswer,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (context.questionType === "ordering") {
    const items = publicPayload.items;
    const correctOrder = solutionPayload.correctOrder;
    const directionLabels = publicPayload.directionLabels;
    if (
      !Array.isArray(items) ||
      items.length < 2 ||
      items.length > 8 ||
      !items.every(
        (item) => typeof item === "string" && item.trim().length > 0 && item.length <= 500,
      ) ||
      new Set(items).size !== items.length ||
      !Array.isArray(correctOrder) ||
      correctOrder.length !== items.length ||
      !correctOrder.every((item) => typeof item === "string" && items.includes(item)) ||
      new Set(correctOrder).size !== correctOrder.length ||
      (directionLabels !== undefined &&
        directionLabels !== null &&
        (typeof directionLabels !== "object" ||
          Array.isArray(directionLabels) ||
          !Object.keys(directionLabels).every((key) => ["start", "end"].includes(key)) ||
          !Object.hasOwn(directionLabels, "start") ||
          !Object.hasOwn(directionLabels, "end") ||
          typeof (directionLabels as Record<string, unknown>).start !== "string" ||
          typeof (directionLabels as Record<string, unknown>).end !== "string" ||
          ((directionLabels as Record<string, unknown>).start as string).trim().length === 0 ||
          ((directionLabels as Record<string, unknown>).end as string).trim().length === 0))
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "ordering",
      items,
      correctOrder,
      directionLabels:
        directionLabels && typeof directionLabels === "object"
          ? (directionLabels as OrderingQuestion["directionLabels"])
          : undefined,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (context.questionType === "anagram") {
    const tiles = publicPayload.tiles;
    const correctAnswer = solutionPayload.correctAnswer;
    if (
      !Array.isArray(tiles) ||
      tiles.length < 3 ||
      tiles.length > 10 ||
      !tiles.every((tile) => {
        if (!tile || typeof tile !== "object" || Array.isArray(tile)) return false;
        const value = tile as Record<string, unknown>;
        return (
          Object.keys(value).every((key) => ["id", "value"].includes(key)) &&
          typeof value.id === "string" &&
          value.id.trim().length > 0 &&
          value.id.length <= 120 &&
          typeof value.value === "string" &&
          value.value.trim().length > 0 &&
          Array.from(value.value).length === 1
        );
      }) ||
      new Set(tiles.map((tile) => (tile as Record<string, unknown>).id as string)).size !==
        tiles.length ||
      typeof correctAnswer !== "string" ||
      correctAnswer.trim().length === 0 ||
      /\s/.test(correctAnswer) ||
      Array.from(correctAnswer).length !== tiles.length
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    const tileSignature = tiles
      .map((tile) => String((tile as Record<string, unknown>).value).toLocaleLowerCase("es"))
      .sort()
      .join("");
    const solutionSignature = Array.from(correctAnswer.toLocaleLowerCase("es")).sort().join("");
    if (tileSignature !== solutionSignature) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "anagram",
      tiles: tiles as AnagramQuestion["tiles"],
      hint: typeof publicPayload.hint === "string" ? publicPayload.hint : undefined,
      correctAnswer,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (context.questionType === "classification") {
    const items = publicPayload.items;
    const categories = publicPayload.categories;
    const categoriesByItem = solutionPayload.categoriesByItem;
    if (
      !Array.isArray(items) ||
      items.length < 2 ||
      items.length > 20 ||
      !items.every(
        (item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          Object.keys(item).every((key) => key === "label") &&
          typeof (item as Record<string, unknown>).label === "string" &&
          ((item as Record<string, unknown>).label as string).trim().length > 0,
      ) ||
      new Set(items.map((item) => (item as Record<string, unknown>).label as string)).size !==
        items.length ||
      !Array.isArray(categories) ||
      categories.length < 2 ||
      categories.length > 8 ||
      !categories.every((category) => typeof category === "string" && category.trim().length > 0) ||
      new Set(categories).size !== categories.length ||
      !categoriesByItem ||
      typeof categoriesByItem !== "object" ||
      Array.isArray(categoriesByItem)
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    const solution = categoriesByItem as Record<string, unknown>;
    const labels = items.map((item) => (item as Record<string, unknown>).label as string);
    if (
      Object.keys(solution).length !== labels.length ||
      labels.some(
        (label) =>
          typeof solution[label] !== "string" || !categories.includes(solution[label] as string),
      ) ||
      Object.keys(solution).some((label) => !labels.includes(label))
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "classification",
      items: items.map((item) => ({
        label: (item as Record<string, unknown>).label as string,
        correctCategory: solution[(item as Record<string, unknown>).label as string] as string,
      })),
      categories,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } as ClassificationQuestion;
  }
  if (context.questionType === "progressive-image") {
    const surface = publicPayload.surface;
    const revealDurationMs = publicPayload.revealDurationMs;
    const correctAnswer = solutionPayload.correctAnswer;
    const acceptedAnswers = solutionPayload.acceptedAnswers;
    if (
      !surface ||
      typeof surface !== "object" ||
      Array.isArray(surface) ||
      typeof (surface as Record<string, unknown>).src !== "string" ||
      typeof (surface as Record<string, unknown>).alt !== "string" ||
      !Number.isSafeInteger((surface as Record<string, unknown>).width) ||
      Number((surface as Record<string, unknown>).width) <= 0 ||
      !Number.isSafeInteger((surface as Record<string, unknown>).height) ||
      Number((surface as Record<string, unknown>).height) <= 0 ||
      ((surface as Record<string, unknown>).fit !== undefined &&
        (surface as Record<string, unknown>).fit !== "cover" &&
        (surface as Record<string, unknown>).fit !== "contain") ||
      typeof revealDurationMs !== "number" ||
      !Number.isSafeInteger(revealDurationMs) ||
      revealDurationMs <= 0 ||
      revealDurationMs >= context.timeLimitMs ||
      typeof correctAnswer !== "string" ||
      !Array.isArray(acceptedAnswers) ||
      !acceptedAnswers.every((answer) => typeof answer === "string") ||
      typeof solutionPayload.solutionAlt !== "string"
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "progressive-image",
      surface: surface as ProgressiveImageQuestion["surface"],
      revealDuration: revealDurationMs / 1000,
      correctAnswer,
      acceptedAnswers,
      solutionAlt: solutionPayload.solutionAlt,
      answerLabel:
        typeof publicPayload.answerLabel === "string" ? publicPayload.answerLabel : undefined,
      answerPlaceholder:
        typeof publicPayload.answerPlaceholder === "string"
          ? publicPayload.answerPlaceholder
          : undefined,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (context.questionType === "logic-code") {
    const clues = publicPayload.clues;
    const codeLength = publicPayload.codeLength;
    const correctAnswer = solutionPayload.correctAnswer;
    if (
      typeof codeLength !== "number" ||
      !Number.isSafeInteger(codeLength) ||
      codeLength < 1 ||
      codeLength > 12 ||
      !Array.isArray(clues) ||
      clues.length === 0 ||
      clues.length > 20 ||
      !clues.every((clue) => {
        if (!clue || typeof clue !== "object" || Array.isArray(clue)) return false;
        const value = clue as Record<string, unknown>;
        return (
          typeof value.code === "string" &&
          typeof value.hint === "string" &&
          value.code.length === codeLength &&
          /^[0-9]+$/.test(value.code)
        );
      }) ||
      typeof correctAnswer !== "string" ||
      correctAnswer.length !== codeLength ||
      !/^[0-9]+$/.test(correctAnswer)
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "logic-code",
      clues: clues as LogicCodeQuestion["clues"],
      codeLength,
      correctAnswer,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (context.questionType === "logic-matrix") {
    const matrixPayload = {
      pieces: publicPayload.pieces,
      cells: publicPayload.cells,
      optionIds: publicPayload.optionIds,
      ...(publicPayload.showPieceLabels !== undefined
        ? { showPieceLabels: publicPayload.showPieceLabels }
        : {}),
    };
    const correctOptionId = solutionPayload.correctOptionId;
    if (
      !isValidLogicMatrixPublicPayload(matrixPayload) ||
      typeof correctOptionId !== "string" ||
      !matrixPayload.optionIds.includes(correctOptionId)
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "logic-matrix",
      pieces: matrixPayload.pieces,
      cells: matrixPayload.cells,
      optionIds: matrixPayload.optionIds,
      correctOptionId,
      showPieceLabels:
        typeof matrixPayload.showPieceLabels === "boolean" ? matrixPayload.showPieceLabels : true,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies LogicMatrixQuestion;
  }
  if (context.questionType === "connect-pairs") {
    const grid = publicPayload.grid;
    const pairs = publicPayload.pairs;
    const paths = solutionPayload.paths;
    if (publicPayload.requireFullCoverage !== true) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    const question = {
      ...base,
      type: "connect-pairs" as const,
      grid: grid as ConnectPairsQuestion["grid"],
      pairs: pairs as ConnectPairsQuestion["pairs"],
      solutionPaths: paths as ConnectPairsQuestion["solutionPaths"],
      requireFullCoverage: true as const,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies ConnectPairsQuestion;
    if (!isValidConnectPairsConfiguration(question)) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return question;
  }
  if (context.questionType === "progressive-clues") {
    const clues = publicPayload.clues;
    const cluePenalty = publicPayload.cluePenalty;
    const correctAnswer = solutionPayload.correctAnswer;
    const acceptedAnswers = solutionPayload.acceptedAnswers;
    if (
      !Array.isArray(clues) ||
      clues.length === 0 ||
      clues.length > 20 ||
      !clues.every((clue) => typeof clue === "string" && clue.trim().length > 0) ||
      typeof cluePenalty !== "number" ||
      !Number.isSafeInteger(cluePenalty) ||
      cluePenalty < 0 ||
      typeof correctAnswer !== "string" ||
      !Array.isArray(acceptedAnswers) ||
      !acceptedAnswers.every((answer) => typeof answer === "string" && answer.trim().length > 0)
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "progressive-clues",
      clues,
      cluePenalty,
      correctAnswer,
      acceptedAnswers,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (context.questionType === "matching") {
    const leftItems = publicPayload.leftItems;
    const rightItems = publicPayload.rightItems;
    const matches = solutionPayload.matches;
    if (
      !Array.isArray(leftItems) ||
      !Array.isArray(rightItems) ||
      leftItems.length < 3 ||
      leftItems.length > 6 ||
      rightItems.length !== leftItems.length ||
      !leftItems.every((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        const value = item as Record<string, unknown>;
        return (
          !Object.hasOwn(value, "correctMatchId") &&
          typeof value.id === "string" &&
          value.id.trim().length > 0 &&
          value.id.length <= 120 &&
          typeof value.label === "string" &&
          value.label.trim().length > 0 &&
          value.label.length <= 500
        );
      }) ||
      !rightItems.every((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        const value = item as Record<string, unknown>;
        return (
          !Object.hasOwn(value, "correctMatchId") &&
          typeof value.id === "string" &&
          value.id.trim().length > 0 &&
          value.id.length <= 120 &&
          typeof value.label === "string" &&
          value.label.trim().length > 0 &&
          value.label.length <= 500
        );
      }) ||
      !matches ||
      typeof matches !== "object" ||
      Array.isArray(matches)
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    const leftIds = leftItems.map((item) => (item as Record<string, unknown>).id as string);
    const rightIds = rightItems.map((item) => (item as Record<string, unknown>).id as string);
    const matchRecord = matches as Record<string, unknown>;
    if (
      new Set(leftIds).size !== leftIds.length ||
      new Set(rightIds).size !== rightIds.length ||
      Object.keys(matchRecord).length !== leftIds.length ||
      !leftIds.every(
        (leftId) =>
          typeof matchRecord[leftId] === "string" &&
          rightIds.includes(matchRecord[leftId] as string),
      ) ||
      new Set(Object.values(matchRecord)).size !== rightIds.length
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "matching",
      leftItems: leftItems.map((item) => ({
        ...(item as MatchingQuestion["leftItems"][number]),
        correctMatchId: matchRecord[(item as Record<string, unknown>).id as string] as string,
      })),
      rightItems: rightItems as MatchingQuestion["rightItems"],
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (context.questionType === "queens") {
    const grid = publicPayload.grid;
    const regions = publicPayload.regions;
    const prefilledQueens = publicPayload.prefilledQueens;
    const solution = solutionPayload.solution;
    if (
      !grid ||
      typeof grid !== "object" ||
      Array.isArray(grid) ||
      (grid as Record<string, unknown>).rows !== 5 ||
      (grid as Record<string, unknown>).columns !== 5 ||
      !Array.isArray(regions) ||
      regions.length !== 25 ||
      !regions.every(
        (region) =>
          typeof region === "number" && Number.isSafeInteger(region) && region >= 0 && region < 5,
      ) ||
      !Array.isArray(prefilledQueens) ||
      !prefilledQueens.every(
        (cell) => typeof cell === "number" && Number.isSafeInteger(cell) && cell >= 0 && cell < 25,
      ) ||
      !Array.isArray(solution) ||
      !solution.every(
        (cell) => typeof cell === "number" && Number.isSafeInteger(cell) && cell >= 0 && cell < 25,
      ) ||
      new Set(solution).size !== solution.length
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "queens",
      grid: { rows: 5, columns: 5 },
      regions,
      prefilledQueens,
      solution,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (context.questionType === "word-search") {
    const grid = publicPayload.grid;
    const letters = publicPayload.letters;
    const publicTargets = publicPayload.targets;
    const positions = solutionPayload.positionsByTargetId;
    if (
      !grid ||
      typeof grid !== "object" ||
      Array.isArray(grid) ||
      !Number.isSafeInteger((grid as Record<string, unknown>).rows) ||
      !Number.isSafeInteger((grid as Record<string, unknown>).columns) ||
      !Array.isArray(letters) ||
      !Array.isArray(publicTargets) ||
      !positions ||
      typeof positions !== "object" ||
      Array.isArray(positions) ||
      !publicTargets.every((target) => {
        if (!target || typeof target !== "object" || Array.isArray(target)) return false;
        const value = target as Record<string, unknown>;
        const position = (positions as Record<string, unknown>)[String(value.id)];
        return (
          typeof value.id === "string" &&
          typeof value.word === "string" &&
          position &&
          typeof position === "object" &&
          !Array.isArray(position) &&
          Number.isSafeInteger((position as Record<string, unknown>).startCell) &&
          Number.isSafeInteger((position as Record<string, unknown>).endCell)
        );
      })
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    const question = {
      ...base,
      type: "word-search" as const,
      grid: grid as WordSearchQuestion["grid"],
      letters: letters as string[],
      targets: publicTargets.map((target) => {
        const value = target as Record<string, unknown>;
        const position = (positions as Record<string, Record<string, unknown>>)[value.id as string];
        return {
          id: value.id as string,
          word: value.word as string,
          startCell: position.startCell as number,
          endCell: position.endCell as number,
        };
      }),
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies WordSearchQuestion;
    if (!isValidWordSearchConfiguration(question)) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return question;
  }
  if (context.questionType === "word-hashtag") {
    const configuration = {
      grid: publicPayload.grid,
      initialLetters: publicPayload.initialLetters,
      maxMoves: publicPayload.maxMoves,
    };
    const words = solutionPayload.words;
    if (
      !isValidWordHashtagPublicConfiguration(configuration as never) ||
      !words ||
      typeof words !== "object" ||
      Array.isArray(words)
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    const question = {
      ...base,
      type: "word-hashtag" as const,
      grid: { rows: 5, columns: 5 } as const,
      initialLetters: configuration.initialLetters as Array<string | null>,
      maxMoves: configuration.maxMoves as number,
      words: words as WordHashtagQuestion["words"],
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies WordHashtagQuestion;
    if (!isValidWordHashtagConfiguration(question)) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return question;
  }
  if (context.questionType === "zip") {
    const configuration = {
      grid: publicPayload.grid,
      checkpoints: publicPayload.checkpoints,
    };
    const solution = solutionPayload.solution;
    if (
      !isValidZipPublicConfiguration(configuration) ||
      !Array.isArray(solution) ||
      solution.length !== 25 ||
      !solution.every((cell) => Number.isSafeInteger(cell))
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    const question = {
      ...base,
      type: "zip" as const,
      grid: configuration.grid,
      checkpoints: configuration.checkpoints,
      solution,
      instruction:
        typeof publicPayload.instruction === "string" ? publicPayload.instruction : undefined,
      mapNote: typeof publicPayload.mapNote === "string" ? publicPayload.mapNote : undefined,
      boardLabel:
        typeof publicPayload.boardLabel === "string" ? publicPayload.boardLabel : undefined,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies ZipQuestion;
    if (!isValidZipConfiguration(question)) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return question;
  }
  if (context.questionType === "escape") {
    const configuration = {
      grid: publicPayload.grid,
      initialBlocks: publicPayload.initialBlocks,
    };
    const referenceSolution = solutionPayload.referenceSolution;
    const question = {
      ...base,
      type: "escape" as const,
      grid: configuration.grid as EscapeQuestion["grid"],
      initialBlocks: configuration.initialBlocks as EscapeQuestion["initialBlocks"],
      referenceSolution: referenceSolution as EscapeQuestion["referenceSolution"],
      optimalMoves: solutionPayload.optimalMoves as number,
      instruction:
        typeof publicPayload.instruction === "string" ? publicPayload.instruction : undefined,
      hideInstruction: publicPayload.hideInstruction === true,
      objectiveLabel:
        typeof publicPayload.objectiveLabel === "string" ? publicPayload.objectiveLabel : undefined,
      hideObjectiveLabel: publicPayload.hideObjectiveLabel === true,
      completionMessage:
        typeof publicPayload.completionMessage === "string"
          ? publicPayload.completionMessage
          : undefined,
      boardLabel:
        typeof publicPayload.boardLabel === "string" ? publicPayload.boardLabel : undefined,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies EscapeQuestion;
    if (
      !isValidEscapePublicConfiguration(configuration as EscapeQuestion) ||
      !Array.isArray(referenceSolution) ||
      !Number.isSafeInteger(solutionPayload.optimalMoves) ||
      !isValidEscapeConfiguration(question)
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return question;
  }
  if (context.questionType !== "mini-wordle") throw new AttemptCommandError("unsupported_question");
  const wordLength = publicPayload.wordLength;
  const maxAttempts = publicPayload.maxAttempts;
  const correctAnswer = solutionPayload.correctAnswer;
  const additionalGuesses = solutionPayload.additionalGuesses;
  if (
    !isMiniWordleWordLength(wordLength) ||
    !isMiniWordleMaxAttempts(maxAttempts) ||
    typeof correctAnswer !== "string" ||
    !isValidMiniWordleWord(correctAnswer, wordLength) ||
    !Array.isArray(additionalGuesses) ||
    !additionalGuesses.every(
      (guess) => typeof guess === "string" && isValidMiniWordleWord(guess, wordLength),
    )
  ) {
    throw new AttemptCommandError("invalid_question_payload");
  }
  return {
    ...base,
    type: "mini-wordle",
    hint: typeof publicPayload.hint === "string" ? publicPayload.hint : undefined,
    wordLength,
    maxAttempts,
    correctAnswer: normalizeMiniWordleWord(correctAnswer),
    additionalGuesses: additionalGuesses.map(normalizeMiniWordleWord),
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  };
}

export class SupabaseAttemptCommands implements Pick<
  AttemptCommands,
  | "start"
  | "prepare"
  | "receiveAnswer"
  | "pass"
  | "submitMatchingPair"
  | "submitWordSearchSelection"
  | "submitWordHashtagSwap"
  | "submitMiniWordleGuess"
  | "submitLogicCodeAttempt"
  | "submitQueensPlacement"
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
    return callCommand<StartAttemptResult>(this.identity, "start_attempt", input);
  }

  async prepare(input: Parameters<AttemptCommands["prepare"]>[0]) {
    const prepared = await callCommand<PrepareInteractionResult>(
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

  receiveAnswer(input: SubmitAnswerInput) {
    return callCommand<ReceiveAnswerResult>(this.identity, "receive_answer", input);
  }

  pass(input: Parameters<AttemptCommands["pass"]>[0]) {
    return callCommand<PassInteractionResult>(this.identity, "pass_interaction", input);
  }

  async submitMiniWordleGuess(input: Parameters<AttemptCommands["submitMiniWordleGuess"]>[0]) {
    const accepted = await callCommand<SubmitMiniWordleGuessResult>(
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

  async submitMatchingPair(input: Parameters<AttemptCommands["submitMatchingPair"]>[0]) {
    const accepted = await callCommand<SubmitMatchingPairResult>(
      this.identity,
      "submit_matching_pair",
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
    const accepted = await callCommand<SubmitWordSearchSelectionResult>(
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
    const accepted = await callCommand<SubmitWordHashtagSwapResult>(
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
    const accepted = await callCommand<SubmitLogicCodeAttemptResult>(
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
    const accepted = await callCommand<SubmitQueensPlacementResult>(
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

  revealProgressiveClue(input: Parameters<AttemptCommands["revealProgressiveClue"]>[0]) {
    return callCommand<RevealProgressiveClueResult>(
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
    const resolvedContext = {
      ...context,
      publicPayload: (await resolveCompetitiveQuestionPayload({
        authUserId: this.identity.authUserId,
        attemptId: input.receive.attemptId,
        publicPayload: context.publicPayload,
      })) as EvaluationContext["publicPayload"],
    };
    const result: Pick<
      ReturnType<typeof evaluateReceipt>,
      "status" | "points" | "details"
    > = resolvedContext.mode === "pyramid" && resolvedContext.answer === null
      ? { status: "unanswered" as const, points: 0 }
      : evaluateReceipt({
          receipt: {
            timeUsedMs: resolvedContext.timeUsedMs,
            timedOut: resolvedContext.timedOut,
          },
          question: asQuestion(resolvedContext),
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
      ReturnType<typeof evaluateReceipt>,
      "status" | "points" | "details"
    > = resolvedContext.mode === "pyramid" && resolvedContext.answer === null
      ? { status: "unanswered" as const, points: 0 }
      : evaluateReceipt({
          receipt: { timeUsedMs: resolvedContext.timeUsedMs, timedOut: resolvedContext.timedOut },
          question: asQuestion(resolvedContext),
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
