import type {
  AnagramQuestion,
  ClassificationQuestion,
  EstimationQuestion,
  HeatMapQuestion,
  FlashChallenge,
  LogicCodeQuestion,
  MatchingQuestion,
  MiniWordleQuestion,
  ProgressiveCluesQuestion,
  ProgressiveImageQuestion,
  QuestionOfType,
} from "@/types/game";
import type {
  ServerFlashChallenge,
  ServerFlashQuestion,
  ServerFlashTerminalReview,
  ServerLogicCodeQuestion,
  ServerMatchingQuestion,
  ServerProgressiveCluesQuestion,
  ServerProgressiveImageQuestion,
  ServerQueensProgress,
  ServerTrueFalseQuestion,
  ServerOddOneOutQuestion,
  ServerOrderingQuestion,
  ServerAnagramQuestion,
  ServerClassificationQuestion,
  ServerEstimationQuestion,
  ServerHeatMapQuestion,
} from "@/types/gameplay/challenge";
import type { MiniWordleLetterFeedback } from "@/lib/miniWordle";
import type { QuestionIllustration, QuestionMedia } from "@/types/question";
import {
  isValidEstimationAnswer,
  isValidEstimationConfiguration,
  isValidEstimationSolution,
} from "@/lib/estimation";
import { isNormalizedPoint, isValidHeatMapRadii } from "@/lib/heatMap";

type TerminalReviewResponseRow = {
  challenge_item_id: string;
  public_payload: unknown;
  solution_payload: unknown;
};

export class ServerFlashQuestionError extends Error {
  constructor() {
    super("invalid_question_payload");
  }
}

function imageSurface(payload: Record<string, unknown>): ServerProgressiveImageQuestion["surface"] {
  const surface = payload.surface;
  if (!surface || typeof surface !== "object" || Array.isArray(surface)) {
    throw new ServerFlashQuestionError();
  }
  const value = surface as Record<string, unknown>;
  if (
    typeof value.src !== "string" ||
    typeof value.alt !== "string" ||
    !Number.isSafeInteger(value.width) ||
    Number(value.width) <= 0 ||
    !Number.isSafeInteger(value.height) ||
    Number(value.height) <= 0 ||
    (value.fit !== undefined && value.fit !== "cover" && value.fit !== "contain") ||
    (value.position !== undefined && typeof value.position !== "string")
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    src: value.src,
    alt: value.alt,
    width: value.width,
    height: value.height,
    ...(value.fit ? { fit: value.fit } : {}),
    ...(typeof value.position === "string" ? { position: value.position } : {}),
  } as ServerProgressiveImageQuestion["surface"];
}

function questionMedia(payload: Record<string, unknown>): QuestionMedia | undefined {
  const media = payload.media;
  if (media === undefined || media === null) return undefined;
  if (!media || typeof media !== "object" || Array.isArray(media)) {
    throw new ServerFlashQuestionError();
  }
  const value = media as Record<string, unknown>;
  if (value.type === "illustration") {
    const illustrations: readonly QuestionIllustration[] = [
      "japan-flag",
      "saturn",
      "italy-flag",
      "france-flag",
    ];
    if (
      !illustrations.includes(value.id as QuestionIllustration) ||
      typeof value.alt !== "string" ||
      value.alt.trim().length === 0
    ) {
      throw new ServerFlashQuestionError();
    }
    return { type: "illustration", id: value.id as QuestionIllustration, alt: value.alt };
  }
  if (
    value.type !== "image" ||
    typeof value.src !== "string" ||
    value.src.trim().length === 0 ||
    typeof value.alt !== "string" ||
    value.alt.trim().length === 0 ||
    (value.fit !== undefined && value.fit !== "cover" && value.fit !== "contain") ||
    (value.position !== undefined && typeof value.position !== "string")
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    type: "image",
    src: value.src,
    alt: value.alt,
    ...(value.fit ? { fit: value.fit } : {}),
    ...(typeof value.position === "string" ? { position: value.position } : {}),
  };
}

function payloadRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ServerFlashQuestionError();
  }
  return payload as Record<string, unknown>;
}

export function questionFromPayload(
  id: string,
  payload: unknown,
  timeLimitMs: number,
  points: number,
): QuestionOfType<"multiple-choice">;
export function questionFromPayload(
  id: string,
  payload: unknown,
  timeLimitMs: number,
  points: number,
  questionType:
    | "multiple-choice"
    | "mini-wordle"
    | "logic-code"
    | "progressive-clues"
    | "matching"
    | "progressive-image"
    | "queens"
    | "true-false"
    | "odd-one-out"
    | "ordering"
    | "anagram"
    | "classification"
    | "estimation"
    | "heat-map",
  progress?: unknown,
  allowCompleteProgress?: boolean,
): ServerFlashQuestion;
export function questionFromPayload(
  id: string,
  payload: unknown,
  timeLimitMs: number,
  points: number,
  questionType?:
    | "multiple-choice"
    | "mini-wordle"
    | "logic-code"
    | "progressive-clues"
    | "matching"
    | "progressive-image"
    | "queens"
    | "true-false"
    | "odd-one-out"
    | "ordering"
    | "anagram"
    | "classification"
    | "estimation"
    | "heat-map",
  progress?: unknown,
  allowCompleteProgress = false,
): ServerFlashQuestion | QuestionOfType<"multiple-choice"> {
  const value = payloadRecord(payload);
  const prompt = value.question ?? value.prompt;
  if (typeof prompt !== "string") throw new ServerFlashQuestionError();
  const base = {
    id,
    category: typeof value.category === "string" ? value.category : "",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
    question: prompt,
    timeLimit: timeLimitMs / 1000,
    points,
  } as const;
  if (questionType === undefined) {
    if (
      !Array.isArray(value.options) ||
      !value.options.every((option) => typeof option === "string")
    ) {
      throw new ServerFlashQuestionError();
    }
    const media = questionMedia(value);
    return {
      ...base,
      type: "multiple-choice",
      options: value.options,
      ...(media ? { media } : {}),
      correctAnswer: "",
      explanation: "",
    };
  }
  if (questionType === "multiple-choice") {
    if (
      !Array.isArray(value.options) ||
      !value.options.every((option) => typeof option === "string")
    ) {
      throw new ServerFlashQuestionError();
    }
    const media = questionMedia(value);
    return {
      ...base,
      type: "multiple-choice",
      options: value.options,
      ...(media ? { media } : {}),
    };
  }
  if (questionType === "estimation") {
    const configuration = {
      min: value.min,
      max: value.max,
      step: value.step,
      initialValue: value.initialValue,
      unit: value.unit,
    };
    const media = questionMedia(value);
    if (
      !isValidEstimationConfiguration(configuration) ||
      typeof value.media === "undefined" ||
      (media !== undefined && !media)
    ) {
      throw new ServerFlashQuestionError();
    }
    return {
      ...base,
      type: "estimation",
      min: configuration.min as number,
      max: configuration.max as number,
      step: configuration.step as number,
      initialValue: configuration.initialValue as number,
      unit: configuration.unit as string,
      ...(media ? { media } : {}),
    } satisfies ServerEstimationQuestion;
  }
  if (questionType === "heat-map") {
    if (typeof value.targetLabel !== "string" || value.targetLabel.trim().length === 0) {
      throw new ServerFlashQuestionError();
    }
    return {
      ...base,
      type: "heat-map",
      surface: imageSurface(value),
      targetLabel: value.targetLabel,
    } satisfies ServerHeatMapQuestion;
  }
  if (questionType === "true-false") {
    return { ...base, type: "true-false" } satisfies ServerTrueFalseQuestion;
  }
  if (questionType === "odd-one-out") {
    const items = value.items;
    if (!Array.isArray(items) || items.length < 3 || items.length > 8) {
      throw new ServerFlashQuestionError();
    }
    const parsedItems = items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new ServerFlashQuestionError();
      }
      const record = item as Record<string, unknown>;
      if (
        !Object.keys(record).every((key) => ["id", "label", "media"].includes(key)) ||
        typeof record.id !== "string" ||
        record.id.trim().length === 0 ||
        record.id.length > 120 ||
        typeof record.label !== "string" ||
        record.label.trim().length === 0 ||
        record.label.length > 500
      ) {
        throw new ServerFlashQuestionError();
      }
      const media = questionMedia(record);
      return {
        id: record.id,
        label: record.label,
        ...(media ? { media } : {}),
      };
    });
    if (new Set(parsedItems.map((item) => item.id)).size !== parsedItems.length) {
      throw new ServerFlashQuestionError();
    }
    return { ...base, type: "odd-one-out", items: parsedItems } satisfies ServerOddOneOutQuestion;
  }
  if (questionType === "ordering") {
    const items = value.items;
    const directionLabels = value.directionLabels;
    if (
      !Array.isArray(items) ||
      items.length < 2 ||
      items.length > 8 ||
      !items.every(
        (item) => typeof item === "string" && item.trim().length > 0 && item.length <= 500,
      ) ||
      new Set(items).size !== items.length
    ) {
      throw new ServerFlashQuestionError();
    }
    let parsedDirectionLabels: ServerOrderingQuestion["directionLabels"] = null;
    if (directionLabels !== undefined && directionLabels !== null) {
      if (
        typeof directionLabels !== "object" ||
        Array.isArray(directionLabels) ||
        !Object.keys(directionLabels).every((key) => ["start", "end"].includes(key))
      ) {
        throw new ServerFlashQuestionError();
      }
      const labels = directionLabels as Record<string, unknown>;
      if (
        typeof labels.start !== "string" ||
        labels.start.trim().length === 0 ||
        labels.start.length > 120 ||
        typeof labels.end !== "string" ||
        labels.end.trim().length === 0 ||
        labels.end.length > 120
      ) {
        throw new ServerFlashQuestionError();
      }
      parsedDirectionLabels = { start: labels.start, end: labels.end };
    }
    return {
      ...base,
      type: "ordering",
      items,
      directionLabels: parsedDirectionLabels,
    } satisfies ServerOrderingQuestion;
  }
  if (questionType === "anagram") {
    const tiles = value.tiles;
    const hint = value.hint;
    if (
      !Array.isArray(tiles) ||
      tiles.length < 3 ||
      tiles.length > 10 ||
      !tiles.every((tile) => {
        if (!tile || typeof tile !== "object" || Array.isArray(tile)) return false;
        const record = tile as Record<string, unknown>;
        return (
          Object.keys(record).every((key) => ["id", "value"].includes(key)) &&
          typeof record.id === "string" &&
          record.id.trim().length > 0 &&
          record.id.length <= 120 &&
          typeof record.value === "string" &&
          record.value.trim().length > 0 &&
          Array.from(record.value).length === 1
        );
      }) ||
      new Set(tiles.map((tile) => (tile as Record<string, unknown>).id as string)).size !==
        tiles.length ||
      (hint !== undefined && hint !== null && (typeof hint !== "string" || hint.length > 500))
    ) {
      throw new ServerFlashQuestionError();
    }
    return {
      ...base,
      type: "anagram",
      tiles: tiles.map((tile) => ({
        id: (tile as Record<string, unknown>).id as string,
        value: (tile as Record<string, unknown>).value as string,
      })),
      hint: typeof hint === "string" ? hint : null,
    } satisfies ServerAnagramQuestion;
  }
  if (questionType === "classification") {
    const items = value.items;
    const categories = value.categories;
    if (
      !Array.isArray(items) ||
      items.length < 2 ||
      items.length > 20 ||
      !items.every((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        const record = item as Record<string, unknown>;
        return (
          Object.keys(record).every((key) => key === "label") &&
          typeof record.label === "string" &&
          record.label.trim().length > 0 &&
          record.label.length <= 500
        );
      }) ||
      new Set(items.map((item) => (item as Record<string, unknown>).label as string)).size !==
        items.length ||
      !Array.isArray(categories) ||
      categories.length < 2 ||
      categories.length > 8 ||
      !categories.every(
        (category) =>
          typeof category === "string" && category.trim().length > 0 && category.length <= 120,
      ) ||
      new Set(categories).size !== categories.length
    ) {
      throw new ServerFlashQuestionError();
    }
    return {
      ...base,
      type: "classification",
      items: items.map((item) => ({ label: (item as Record<string, unknown>).label as string })),
      categories,
    } satisfies ServerClassificationQuestion;
  }
  if (questionType === "queens") {
    const grid = value.grid;
    const regions = value.regions;
    const prefilledQueens = value.prefilledQueens;
    const rawProgress =
      progress && typeof progress === "object" && !Array.isArray(progress)
        ? (progress as Record<string, unknown>)
        : {};
    const validCells = (candidate: unknown): candidate is number[] =>
      Array.isArray(candidate) &&
      candidate.every(
        (cell) => Number.isSafeInteger(cell) && Number(cell) >= 0 && Number(cell) < 25,
      ) &&
      new Set(candidate).size === candidate.length;
    const queens = validCells(rawProgress.queens)
      ? rawProgress.queens
      : validCells(prefilledQueens)
        ? prefilledQueens
        : [];
    const safeProgress: ServerQueensProgress = {
      kind: "queens",
      queens,
      placedQueens: Number(rawProgress.placedQueens ?? queens.length),
      completedRows: Number(rawProgress.completedRows ?? 0),
      completedColumns: Number(rawProgress.completedColumns ?? 0),
      completedRegions: Number(rawProgress.completedRegions ?? 0),
      conflictingQueens: Number(rawProgress.conflictingQueens ?? 0),
      solved: rawProgress.solved === true,
    };
    if (
      !grid ||
      typeof grid !== "object" ||
      Array.isArray(grid) ||
      (grid as Record<string, unknown>).rows !== 5 ||
      (grid as Record<string, unknown>).columns !== 5 ||
      !Array.isArray(regions) ||
      regions.length !== 25 ||
      !regions.every(
        (region) => Number.isSafeInteger(region) && Number(region) >= 0 && Number(region) < 5,
      ) ||
      !validCells(prefilledQueens) ||
      !validCells(queens) ||
      safeProgress.placedQueens !== queens.length ||
      ![
        safeProgress.placedQueens,
        safeProgress.completedRows,
        safeProgress.completedColumns,
        safeProgress.completedRegions,
        safeProgress.conflictingQueens,
      ].every((metric) => Number.isSafeInteger(metric) && metric >= 0) ||
      safeProgress.completedRows > 5 ||
      safeProgress.completedColumns > 5 ||
      safeProgress.completedRegions > 5
    ) {
      throw new ServerFlashQuestionError();
    }
    return {
      ...base,
      type: "queens",
      grid: { rows: 5, columns: 5 },
      regions,
      prefilledQueens,
      progress: safeProgress,
    };
  }
  if (questionType === "progressive-image") {
    const revealDurationMs = value.revealDurationMs;
    if (
      typeof revealDurationMs !== "number" ||
      !Number.isSafeInteger(revealDurationMs) ||
      revealDurationMs <= 0 ||
      revealDurationMs >= timeLimitMs
    ) {
      throw new ServerFlashQuestionError();
    }
    return {
      ...base,
      type: "progressive-image",
      surface: imageSurface(value),
      revealDuration: revealDurationMs / 1000,
      answerLabel: typeof value.answerLabel === "string" ? value.answerLabel : null,
      answerPlaceholder:
        typeof value.answerPlaceholder === "string" ? value.answerPlaceholder : null,
    };
  }
  if (questionType === "logic-code") {
    const clues = value.clues;
    const codeLength = value.codeLength;
    if (
      !Array.isArray(clues) ||
      clues.length === 0 ||
      typeof codeLength !== "number" ||
      !Number.isSafeInteger(codeLength) ||
      codeLength < 1 ||
      codeLength > 12 ||
      !clues.every((clue) => {
        if (!clue || typeof clue !== "object" || Array.isArray(clue)) return false;
        const item = clue as Record<string, unknown>;
        return (
          typeof item.code === "string" &&
          typeof item.hint === "string" &&
          item.code.length === codeLength
        );
      })
    ) {
      throw new ServerFlashQuestionError();
    }
    const rawProgress =
      progress && typeof progress === "object" && !Array.isArray(progress)
        ? (progress as Record<string, unknown>)
        : {};
    const submittedCodes = Array.isArray(rawProgress.submittedCodes)
      ? rawProgress.submittedCodes.filter((code): code is string => typeof code === "string")
      : [];
    return {
      ...base,
      type: "logic-code",
      clues: clues as ServerLogicCodeQuestion["clues"],
      codeLength,
      progress: {
        kind: "logic-code",
        submittedCodes,
        incorrectAttempts:
          typeof rawProgress.incorrectAttempts === "number"
            ? rawProgress.incorrectAttempts
            : submittedCodes.length,
      },
    };
  }
  if (questionType === "progressive-clues") {
    const rawProgress =
      progress && typeof progress === "object" && !Array.isArray(progress)
        ? (progress as Record<string, unknown>)
        : {};
    const rawClues = Array.isArray(rawProgress.clues)
      ? rawProgress.clues.filter((clue): clue is string => typeof clue === "string")
      : allowCompleteProgress && Array.isArray(value.clues)
        ? value.clues.filter((clue): clue is string => typeof clue === "string")
        : [];
    const totalClues =
      typeof value.clueCount === "number"
        ? value.clueCount
        : typeof rawProgress.totalClues === "number"
          ? rawProgress.totalClues
          : rawClues.length;
    const cluePenalty = typeof value.cluePenalty === "number" ? value.cluePenalty : Number.NaN;
    const revealedClues =
      typeof rawProgress.revealedClues === "number" ? rawProgress.revealedClues : rawClues.length;
    const availablePoints =
      typeof rawProgress.availablePoints === "number" ? rawProgress.availablePoints : points;
    if (
      !Number.isSafeInteger(totalClues) ||
      totalClues < 1 ||
      totalClues > 20 ||
      !Number.isSafeInteger(cluePenalty) ||
      cluePenalty < 0 ||
      !Number.isSafeInteger(revealedClues) ||
      revealedClues < 1 ||
      revealedClues > totalClues ||
      rawClues.length !== revealedClues ||
      !rawClues.every((clue) => clue.trim().length > 0) ||
      !Number.isSafeInteger(availablePoints) ||
      availablePoints < 0
    ) {
      throw new ServerFlashQuestionError();
    }
    const progressiveProgress: ServerProgressiveCluesQuestion["progress"] = {
      kind: "progressive-clues",
      clues: rawClues,
      revealedClues,
      totalClues,
      availablePoints,
      cluePenalty,
    };
    return {
      ...base,
      type: "progressive-clues",
      clues: rawClues,
      totalClues,
      cluePenalty,
      progress: progressiveProgress,
    };
  }
  if (questionType === "matching") {
    const leftItems = value.leftItems;
    const rightItems = value.rightItems;
    const rawProgress =
      progress && typeof progress === "object" && !Array.isArray(progress)
        ? (progress as Record<string, unknown>)
        : {};
    const isItem = (item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const record = item as Record<string, unknown>;
      return (
        Object.keys(record).every((key) => ["id", "label", "icon", "media"].includes(key)) &&
        typeof record.id === "string" &&
        record.id.trim().length > 0 &&
        record.id.length <= 120 &&
        typeof record.label === "string" &&
        record.label.trim().length > 0 &&
        record.label.length <= 500 &&
        (record.icon === undefined || (typeof record.icon === "string" && record.icon.length <= 32))
      );
    };
    const validLeftItems =
      Array.isArray(leftItems) &&
      leftItems.length >= 3 &&
      leftItems.length <= 6 &&
      leftItems.every(isItem);
    const validRightItems =
      Array.isArray(rightItems) &&
      rightItems.length === (Array.isArray(leftItems) ? leftItems.length : 0) &&
      rightItems.every(isItem);
    const leftIds = validLeftItems
      ? leftItems.map((item) => (item as Record<string, unknown>).id as string)
      : [];
    const rightIds = validRightItems
      ? rightItems.map((item) => (item as Record<string, unknown>).id as string)
      : [];
    const rawMatchedPairs = Array.isArray(rawProgress.matchedPairs) ? rawProgress.matchedPairs : [];
    const matchedPairs = rawMatchedPairs.filter(
      (pair): pair is { leftId: string; rightId: string } => {
        if (!pair || typeof pair !== "object" || Array.isArray(pair)) return false;
        const record = pair as Record<string, unknown>;
        return typeof record.leftId === "string" && typeof record.rightId === "string";
      },
    );
    const matchedLeftIds = new Set(matchedPairs.map((pair) => pair.leftId));
    const matchedRightIds = new Set(matchedPairs.map((pair) => pair.rightId));
    const totalPairs =
      typeof rawProgress.totalPairs === "number"
        ? rawProgress.totalPairs
        : Array.isArray(leftItems)
          ? leftItems.length
          : 0;
    const matchedCount =
      typeof rawProgress.matchedCount === "number" ? rawProgress.matchedCount : matchedPairs.length;
    const incorrectAttempts =
      typeof rawProgress.incorrectAttempts === "number" ? rawProgress.incorrectAttempts : 0;
    const penaltyPoints =
      typeof rawProgress.penaltyPoints === "number" ? rawProgress.penaltyPoints : 0;
    if (
      !validLeftItems ||
      !validRightItems ||
      new Set(leftIds).size !== leftIds.length ||
      new Set(rightIds).size !== rightIds.length ||
      !matchedPairs.every(
        (pair) => leftIds.includes(pair.leftId) && rightIds.includes(pair.rightId),
      ) ||
      matchedLeftIds.size !== matchedPairs.length ||
      matchedRightIds.size !== matchedPairs.length ||
      matchedCount !== matchedPairs.length ||
      totalPairs !== leftIds.length ||
      !Number.isSafeInteger(incorrectAttempts) ||
      incorrectAttempts < 0 ||
      !Number.isSafeInteger(penaltyPoints) ||
      penaltyPoints < 0
    ) {
      throw new ServerFlashQuestionError();
    }
    const safeLeftItems = leftItems as ServerMatchingQuestion["leftItems"];
    const safeRightItems = rightItems as ServerMatchingQuestion["rightItems"];
    return {
      ...base,
      type: "matching",
      leftItems: safeLeftItems,
      rightItems: safeRightItems,
      progress: {
        kind: "matching",
        matchedPairs,
        matchedCount,
        totalPairs,
        incorrectAttempts,
        penaltyPoints,
      },
    };
  }
  const wordLength = value.wordLength;
  const maxAttempts = value.maxAttempts;
  if ((wordLength !== 4 && wordLength !== 5) || typeof maxAttempts !== "number") {
    throw new ServerFlashQuestionError();
  }
  const rawProgress =
    progress && typeof progress === "object" && !Array.isArray(progress)
      ? (progress as Record<string, unknown>)
      : {};
  const guesses = Array.isArray(rawProgress.guesses)
    ? rawProgress.guesses.filter((guess): guess is string => typeof guess === "string")
    : [];
  const feedback = Array.isArray(rawProgress.feedback)
    ? (rawProgress.feedback as MiniWordleLetterFeedback[][])
    : [];
  return {
    ...base,
    type: "mini-wordle",
    hint: typeof value.hint === "string" ? value.hint : null,
    wordLength,
    maxAttempts,
    progress: {
      kind: "mini-wordle",
      guesses,
      feedback,
      attemptsUsed:
        typeof rawProgress.attemptsUsed === "number" ? rawProgress.attemptsUsed : guesses.length,
      maxAttempts,
    },
  };
}

function questionWithSolution(
  question: ServerFlashQuestion,
  row?: ServerFlashTerminalReview,
):
  | QuestionOfType<"multiple-choice">
  | MiniWordleQuestion
  | LogicCodeQuestion
  | ProgressiveCluesQuestion
  | ProgressiveImageQuestion
  | MatchingQuestion
  | QuestionOfType<"queens">
  | QuestionOfType<"true-false">
  | QuestionOfType<"odd-one-out">
  | QuestionOfType<"ordering">
  | AnagramQuestion
  | ClassificationQuestion
  | EstimationQuestion
  | HeatMapQuestion {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (question.type === "mini-wordle") {
    if (typeof solution.correctAnswer !== "string") throw new ServerFlashQuestionError();
    return {
      id: question.id,
      type: "mini-wordle",
      category: question.category,
      tags: question.tags,
      question: question.question,
      hint: question.hint ?? undefined,
      wordLength: question.wordLength,
      maxAttempts: question.maxAttempts,
      correctAnswer: solution.correctAnswer,
      additionalGuesses: Array.isArray(solution.additionalGuesses)
        ? solution.additionalGuesses.filter((guess): guess is string => typeof guess === "string")
        : [],
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  if (question.type === "logic-code") {
    if (typeof solution.correctAnswer !== "string") throw new ServerFlashQuestionError();
    return {
      id: question.id,
      type: "logic-code",
      category: question.category,
      tags: question.tags,
      question: question.question,
      clues: [...question.clues],
      codeLength: question.codeLength,
      correctAnswer: solution.correctAnswer,
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  if (question.type === "progressive-clues") {
    if (typeof solution.correctAnswer !== "string") throw new ServerFlashQuestionError();
    return {
      id: question.id,
      type: "progressive-clues",
      category: question.category,
      tags: question.tags,
      question: question.question,
      clues: [...question.clues],
      cluePenalty: question.cluePenalty,
      correctAnswer: solution.correctAnswer,
      acceptedAnswers: Array.isArray(solution.acceptedAnswers)
        ? solution.acceptedAnswers.filter((answer): answer is string => typeof answer === "string")
        : undefined,
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  if (question.type === "progressive-image") {
    if (
      typeof solution.correctAnswer !== "string" ||
      !Array.isArray(solution.acceptedAnswers) ||
      !solution.acceptedAnswers.every((answer) => typeof answer === "string") ||
      typeof solution.solutionAlt !== "string"
    ) {
      throw new ServerFlashQuestionError();
    }
    return {
      id: question.id,
      type: "progressive-image",
      category: question.category,
      tags: question.tags,
      question: question.question,
      surface: question.surface,
      revealDuration: question.revealDuration,
      answerLabel: question.answerLabel ?? undefined,
      answerPlaceholder: question.answerPlaceholder ?? undefined,
      correctAnswer: solution.correctAnswer,
      acceptedAnswers: solution.acceptedAnswers,
      solutionAlt: solution.solutionAlt,
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  if (question.type === "true-false") {
    if (typeof solution.correctAnswer !== "boolean") {
      throw new ServerFlashQuestionError();
    }
    return {
      id: question.id,
      type: "true-false",
      category: question.category,
      tags: question.tags,
      question: question.question,
      correctAnswer: solution.correctAnswer,
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  if (question.type === "odd-one-out") {
    if (typeof solution.correctAnswer !== "string") {
      throw new ServerFlashQuestionError();
    }
    if (!question.items.some((item) => item.id === solution.correctAnswer)) {
      throw new ServerFlashQuestionError();
    }
    return {
      id: question.id,
      type: "odd-one-out",
      category: question.category,
      tags: question.tags,
      question: question.question,
      items: [...question.items],
      correctAnswer: solution.correctAnswer,
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  if (question.type === "ordering") {
    if (
      !Array.isArray(solution.correctOrder) ||
      solution.correctOrder.length !== question.items.length ||
      !solution.correctOrder.every((item) => question.items.includes(item)) ||
      new Set(solution.correctOrder).size !== solution.correctOrder.length
    ) {
      throw new ServerFlashQuestionError();
    }
    return {
      id: question.id,
      type: "ordering",
      category: question.category,
      tags: question.tags,
      question: question.question,
      items: [...question.items],
      correctOrder: [...solution.correctOrder],
      directionLabels: question.directionLabels ?? undefined,
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  if (question.type === "estimation") {
    const tolerance = solution.tolerance;
    if (
      !isValidEstimationSolution(solution.correctAnswer, tolerance, question) ||
      typeof tolerance !== "number" ||
      !isValidEstimationAnswer(question.initialValue, question)
    ) {
      throw new ServerFlashQuestionError();
    }
    return {
      id: question.id,
      type: "estimation",
      category: question.category,
      tags: question.tags,
      question: question.question,
      min: question.min,
      max: question.max,
      step: question.step,
      initialValue: question.initialValue,
      unit: question.unit,
      ...(question.media ? { media: question.media } : {}),
      correctAnswer: solution.correctAnswer,
      tolerance,
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    } satisfies EstimationQuestion;
  }
  if (question.type === "heat-map") {
    const target = solution.target;
    const fullCreditRadius = solution.fullCreditRadius;
    const toleranceRadius = solution.toleranceRadius;
    if (!isNormalizedPoint(target) || !isValidHeatMapRadii(fullCreditRadius, toleranceRadius)) {
      throw new ServerFlashQuestionError();
    }
    return {
      id: question.id,
      type: "heat-map",
      category: question.category,
      tags: question.tags,
      question: question.question,
      surface: question.surface,
      targetLabel: question.targetLabel,
      target,
      fullCreditRadius: fullCreditRadius as number,
      toleranceRadius: toleranceRadius as number,
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    } satisfies HeatMapQuestion;
  }
  if (question.type === "anagram") {
    if (typeof solution.correctAnswer !== "string") {
      throw new ServerFlashQuestionError();
    }
    return {
      id: question.id,
      type: "anagram",
      category: question.category,
      tags: question.tags,
      question: question.question,
      tiles: [...question.tiles],
      hint: question.hint ?? undefined,
      correctAnswer: solution.correctAnswer,
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  if (question.type === "classification") {
    if (
      !solution.categoriesByItem ||
      typeof solution.categoriesByItem !== "object" ||
      Array.isArray(solution.categoriesByItem)
    ) {
      throw new ServerFlashQuestionError();
    }
    const categoriesByItem = solution.categoriesByItem as Record<string, unknown>;
    const labels = question.items.map((item) => item.label);
    if (
      Object.keys(categoriesByItem).length !== labels.length ||
      labels.some(
        (label) =>
          typeof categoriesByItem[label] !== "string" ||
          !question.categories.includes(categoriesByItem[label] as string),
      ) ||
      Object.keys(categoriesByItem).some((label) => !labels.includes(label))
    ) {
      throw new ServerFlashQuestionError();
    }
    return {
      id: question.id,
      type: "classification",
      category: question.category,
      tags: question.tags,
      question: question.question,
      items: question.items.map((item) => ({
        label: item.label,
        correctCategory: categoriesByItem[item.label] as string,
      })),
      categories: [...question.categories],
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  if (question.type === "queens") {
    const solutionCells = solution.solution;
    if (
      !Array.isArray(solutionCells) ||
      !solutionCells.every((cell) => Number.isSafeInteger(cell) && cell >= 0 && cell < 25)
    ) {
      throw new ServerFlashQuestionError();
    }
    return {
      id: question.id,
      type: "queens",
      category: question.category,
      tags: question.tags,
      question: question.question,
      grid: question.grid,
      regions: [...question.regions],
      prefilledQueens: [...question.prefilledQueens],
      solution: solutionCells,
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  if (question.type === "matching") {
    if (
      !solution.matches ||
      typeof solution.matches !== "object" ||
      Array.isArray(solution.matches)
    ) {
      throw new ServerFlashQuestionError();
    }
    const matches = solution.matches as Record<string, unknown>;
    const leftItems = question.leftItems.map((item) => {
      const rightId = matches[item.id];
      if (typeof rightId !== "string") throw new ServerFlashQuestionError();
      return { ...item, correctMatchId: rightId };
    });
    if (
      Object.keys(matches).length !== leftItems.length ||
      new Set(leftItems.map((item) => item.correctMatchId)).size !== leftItems.length ||
      !leftItems.every((item) =>
        question.rightItems.some((right) => right.id === item.correctMatchId),
      )
    ) {
      throw new ServerFlashQuestionError();
    }
    return {
      id: question.id,
      type: "matching",
      category: question.category,
      tags: question.tags,
      question: question.question,
      leftItems,
      rightItems: [...question.rightItems],
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  return {
    id: question.id,
    type: "multiple-choice",
    category: question.category,
    tags: question.tags,
    question: question.question,
    options: [...question.options],
    timeLimit: question.timeLimit,
    points: question.points,
    ...(typeof solution.correctAnswer === "string"
      ? { correctAnswer: solution.correctAnswer }
      : { correctAnswer: "" }),
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}

export function displayChallenge(challenge: ServerFlashChallenge): FlashChallenge {
  const { slots, ...challengeBase } = challenge;
  return {
    ...challengeBase,
    mode: "flash",
    questions: slots.map((slot) => ({
      id: slot.id,
      type: "multiple-choice" as const,
      category: "",
      tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
      question: "",
      options: [],
      correctAnswer: "",
      timeLimit: slot.timeLimitMs / 1000,
      points: slot.points,
      explanation: "",
    })),
  };
}

export function challengeWithReview(
  challenge: ServerFlashChallenge,
  review: readonly ServerFlashTerminalReview[],
): FlashChallenge {
  const { slots, ...challengeBase } = challenge;
  return {
    ...challengeBase,
    mode: "flash",
    questions: slots.map((slot) => {
      const row = review.find((item) => item.challengeItemId === slot.id);
      return questionWithSolution(
        questionFromPayload(
          slot.id,
          row?.publicPayload,
          slot.timeLimitMs,
          slot.points,
          slot.questionType,
          undefined,
          true,
        ),
        row,
      );
    }),
  };
}

function isTerminalReviewResponseRow(value: unknown): value is TerminalReviewResponseRow {
  if (!value || typeof value !== "object") return false;
  return "challenge_item_id" in value && "solution_payload" in value && "public_payload" in value;
}

export function terminalReviewFromResponse(value: unknown): ServerFlashTerminalReview[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isTerminalReviewResponseRow).map((row) => ({
    challengeItemId: row.challenge_item_id,
    publicPayload: row.public_payload,
    solutionPayload: row.solution_payload,
  }));
}
