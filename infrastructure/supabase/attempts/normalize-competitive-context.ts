import type { EvaluationContext } from "@/application/ports/attempt-commands";
import { competitiveCapabilityFor } from "@/features/question-formats/capabilities";
import type { PublicQuestion, QuestionReveal, QuestionSolution } from "@/types/contracts";
import type { QuestionTagSet } from "@/types/domain/content";
import type { CompetitiveQuestionResolutionInput } from "@/application/ports/competitive-evaluator";
import { AttemptCommandError } from "@/infrastructure/supabase/attempts/attemptCommandError";
import type {
  ConnectPairsQuestion,
  LogicCodeQuestion,
  LogicMatrixQuestion,
  MatchingQuestion,
  MiniWordleQuestion,
  MultipleChoiceQuestion,
  ProgressiveCluesQuestion,
  ProgressiveImageQuestion,
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
  ResolvedQuestion,
} from "@/types/gameplay/scoring";
import {
  isMiniWordleMaxAttempts,
  isMiniWordleWordLength,
  isValidMiniWordleWord,
  normalizeMiniWordleWord,
} from "@/lib/miniWordle";
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
import { isQueensBoardSize, queensCellCount, queensGrid } from "@/lib/queens";

function canonicalTags(value: unknown): QuestionTagSet {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const values = (key: string) => (Array.isArray(record[key]) ? record[key] : []);
  return {
    domains: values("domains") as QuestionTagSet["domains"],
    topics: values("topics") as QuestionTagSet["topics"],
    cognitiveSkills: values("cognitiveSkills") as QuestionTagSet["cognitiveSkills"],
    formatSkills: values("formatSkills") as QuestionTagSet["formatSkills"],
    lifeSkills: values("lifeSkills") as QuestionTagSet["lifeSkills"],
  };
}

function canonicalPublicPayload(context: EvaluationContext): unknown {
  const raw = context.publicPayload as Record<string, unknown>;
  const payload = { ...raw };
  for (const key of ["id", "question", "prompt", "category", "tags", "context", "timeLimitMs"]) {
    delete payload[key];
  }

  switch (context.questionType) {
    case "true-false":
    case "short-text":
      return null;
    case "progressive-clues":
      return {
        clueCount: Array.isArray(raw.clues) ? raw.clues.length : 0,
        cluePenalty: raw.cluePenalty,
      };
    case "ordering":
      return { ...payload, directionLabels: payload.directionLabels ?? null };
    case "anagram":
      return { ...payload, hint: payload.hint ?? null };
    case "progressive-image":
      return {
        ...payload,
        answerLabel: payload.answerLabel ?? null,
        answerPlaceholder: payload.answerPlaceholder ?? null,
      };
    case "logic-matrix":
      return {
        ...payload,
        showPieceLabels:
          typeof payload.showPieceLabels === "boolean" ? payload.showPieceLabels : true,
      };
    case "escape":
      return {
        ...payload,
        instruction: payload.instruction ?? null,
        hideInstruction: payload.hideInstruction === true,
        objectiveLabel: payload.objectiveLabel ?? null,
        hideObjectiveLabel: payload.hideObjectiveLabel === true,
        completionMessage: payload.completionMessage ?? null,
        boardLabel: payload.boardLabel ?? null,
      };
    case "mini-wordle":
      return {
        hint: payload.hint ?? null,
        wordLength: payload.wordLength,
        maxAttempts: payload.maxAttempts,
      };
    default:
      return payload;
  }
}

function canonicalSolutionPayload(context: EvaluationContext, resolved: ResolvedQuestion): unknown {
  const raw = context.solutionPayload as Record<string, unknown>;
  const payload = { ...raw };
  delete payload.explanation;
  if (context.questionType === "mini-wordle") {
    const question = resolved as MiniWordleQuestion;
    return {
      ...payload,
      correctAnswer: question.correctAnswer,
      ...(question.additionalGuesses ? { additionalGuesses: question.additionalGuesses } : {}),
      ...(question.dictionaryId ? { dictionaryId: question.dictionaryId } : {}),
    };
  }
  return payload;
}

function canonicalResolution(
  context: EvaluationContext,
  resolved: ResolvedQuestion,
): CompetitiveQuestionResolutionInput {
  const publicPayload = context.publicPayload as Record<string, unknown>;
  const solutionPayload = context.solutionPayload as Record<string, unknown>;
  const publicQuestion = {
    id: context.questionVersionId,
    type: context.questionType,
    category: typeof publicPayload.category === "string" ? publicPayload.category : "",
    tags: canonicalTags(publicPayload.tags),
    prompt:
      typeof (publicPayload.question ?? publicPayload.prompt) === "string"
        ? (publicPayload.question ?? publicPayload.prompt)
        : "",
    context: typeof publicPayload.context === "string" ? publicPayload.context : null,
    timeLimitMs: context.timeLimitMs,
    payload: canonicalPublicPayload(context),
  } as PublicQuestion;
  const solution = {
    questionVersionId: context.questionVersionId,
    type: context.questionType,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    payload: canonicalSolutionPayload(context, resolved),
  } as QuestionSolution;
  const reveals =
    context.questionType === "progressive-clues" && Array.isArray(publicPayload.clues)
      ? publicPayload.clues.map(
          (clue, clueIndex) =>
            ({
              questionVersionId: context.questionVersionId,
              type: "progressive-clues",
              payload: { clueIndex, clue },
            }) as QuestionReveal,
        )
      : undefined;
  return {
    publicQuestion,
    solution,
    points: context.itemPoints,
    ...(reveals ? { reveals } : {}),
  };
}

export function normalizeCompetitiveEvaluationContext(
  context: EvaluationContext,
): CompetitiveQuestionResolutionInput {
  const resolved = validateStoredCompetitiveQuestion(context);
  return canonicalResolution(context, resolved);
}

function validateStoredCompetitiveQuestion(
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
  const capability = competitiveCapabilityFor(context.questionType, context.mode);
  if (
    capability === null ||
    !capability.payloadSchemaVersions.includes(context.payloadSchemaVersion) ||
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
        ? (tags as ResolvedQuestion["tags"])
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
    const gridRecord = grid && typeof grid === "object" && !Array.isArray(grid) ? grid : null;
    const rows = gridRecord && (gridRecord as Record<string, unknown>).rows;
    const columns = gridRecord && (gridRecord as Record<string, unknown>).columns;
    const boardGrid = isQueensBoardSize(rows) && rows === columns ? queensGrid(rows) : null;
    const cellCount = boardGrid ? queensCellCount(boardGrid) : 0;
    if (
      !grid ||
      typeof grid !== "object" ||
      Array.isArray(grid) ||
      !boardGrid ||
      !Array.isArray(regions) ||
      regions.length !== cellCount ||
      !regions.every(
        (region) =>
          typeof region === "number" &&
          Number.isSafeInteger(region) &&
          region >= 0 &&
          region < boardGrid.rows,
      ) ||
      !Array.isArray(prefilledQueens) ||
      !prefilledQueens.every(
        (cell) =>
          typeof cell === "number" && Number.isSafeInteger(cell) && cell >= 0 && cell < cellCount,
      ) ||
      !Array.isArray(solution) ||
      solution.length !== boardGrid.rows ||
      !solution.every(
        (cell) =>
          typeof cell === "number" && Number.isSafeInteger(cell) && cell >= 0 && cell < cellCount,
      ) ||
      new Set(solution).size !== solution.length
    ) {
      throw new AttemptCommandError("invalid_question_payload");
    }
    return {
      ...base,
      type: "queens",
      grid: boardGrid,
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
