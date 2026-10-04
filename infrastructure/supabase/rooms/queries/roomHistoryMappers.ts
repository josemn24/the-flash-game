import {
  getChallengeDisplayTitle,
  getChallengeFormatLabel,
  getChallengeImage,
  initials,
} from "@/lib/roomPresentation";
import type { AnswerReview, AnswerResult, NarrativeChallenge } from "@/types/gameplay";
import type {
  PracticeChallenge,
  ImageSurface,
  MultipleChoicePromptVisual,
  PracticeQuestion,
  QuestionMedia,
  EstimationQuestion,
  HeatMapQuestion,
  EscapeQuestion,
  LogicMatrixQuestion,
  WordSearchQuestion,
  WordHashtagQuestion,
  ZipQuestion,
} from "@/types/gameplay/practice";
import { assertSupportedQuestionPayloadSchemaVersion } from "@/types/contracts";
import { normalizeAnswer } from "@/lib/normalizeAnswer";
import { alphabetChallengeWithReview } from "@/lib/gameplay/alphabetReview";
import { readPublic as readShortText } from "@/lib/question-formats/short-text/public";
import { questionWithSolution as shortTextWithSolution } from "@/lib/question-formats/short-text/review";
import {
  isValidEstimationAnswer,
  isValidEstimationConfiguration,
  isValidEstimationSolution,
} from "@/lib/estimation";
import { isNormalizedPoint, isValidHeatMapRadii } from "@/lib/heatMap";
import { isValidWordSearchConfiguration } from "@/lib/wordSearch";
import { isValidZipConfiguration } from "@/lib/zip";
import { isValidEscapeConfiguration } from "@/lib/escape";
import { isValidWordHashtagConfiguration } from "@/lib/wordHashtag";
import type {
  RoomDailyLeaderboardEntry,
  RoomHistoryEntry,
  RoomMemberDetailModel,
  RoomMemberReviewItem,
  RoomMemberReviewProgress,
} from "@/types/view-models";
import { deriveCompetitivePyramidProgress } from "@/lib/gameplay/pyramidProgress";
import { deriveSurvivalProgress } from "@/lib/gameplay/survivalProgress";
import { resolveAvatarPath } from "@/lib/media/publicAvatar";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import { isQueensBoardSize, queensCellCount, queensGrid } from "@/lib/queens";
import { isRecord } from "./roomReadGuards";
import type { RoomHistoryReadRow, RoomMemberReviewReadRow, RoomReadRow } from "./roomReadContracts";
import { asMode, playableChallengeHref, toChallengeSummary } from "./roomViewMappers";

export function toHistoryEntry(row: RoomHistoryReadRow): RoomHistoryEntry {
  return {
    id: row.publication_id,
    challengeId: row.publication_id,
    mode: row.challenge_mode,
    title: getChallengeDisplayTitle(row.challenge_title, row.challenge_mode),
    formatLabel: getChallengeFormatLabel(row.challenge_mode),
    subtitle: row.challenge_subtitle,
    questionCount: row.question_count,
    maxScore: row.challenge_max_score,
    playedAt: row.played_at,
    imageSrc: getChallengeImage(row.challenge_mode),
    playerCount: row.player_count,
  };
}

export function toHistoricalLeaderboard(rows: RoomHistoryReadRow[]): RoomDailyLeaderboardEntry[] {
  return rows.flatMap((row) =>
    row.player_id &&
    row.display_name &&
    row.flash_points !== null &&
    row.duration_ms !== null &&
    row.started_at &&
    row.position !== null
      ? [
          {
            rank: row.position,
            memberId: row.player_id,
            name: row.display_name,
            initials: initials(row.display_name),
            avatarSrc: resolveAvatarPath(row.avatar_path),
            flashPoints: row.flash_points,
            completed: true,
            durationMs: row.duration_ms,
            startedAt: row.started_at,
          },
        ]
      : [],
  );
}

export function historicalChallengeSummary(row: RoomHistoryReadRow) {
  return {
    id: row.publication_id,
    mode: row.challenge_mode,
    title: getChallengeDisplayTitle(row.challenge_title, row.challenge_mode),
    formatLabel: getChallengeFormatLabel(row.challenge_mode),
    subtitle: row.challenge_subtitle,
    imageSrc: getChallengeImage(row.challenge_mode),
    questionCount: row.question_count,
    playedAt: row.played_at,
  };
}

export function currentMemberChallengeSummary(row: RoomReadRow) {
  const summary = toChallengeSummary(
    row,
    playableChallengeHref(row.room_slug, row.publication_id ?? ""),
  );
  return summary
    ? {
        id: summary.id,
        mode: asMode(row.challenge_mode) ?? "flash",
        title: summary.title,
        formatLabel: summary.formatLabel,
        subtitle: summary.subtitle,
        imageSrc: summary.imageSrc,
        questionCount: summary.questionCount,
        playedAt: summary.availableUntil,
      }
    : null;
}

export function requiredRecordField(record: Record<string, unknown>, key: string, label: string) {
  const value = record[key];
  if (!isRecord(value)) throw new Error(`Invalid ${label}.${key} payload`);
  return value;
}

export function requiredStringField(record: Record<string, unknown>, key: string, label: string) {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`Invalid ${label}.${key} payload`);
  return value;
}

export function toHistoricalFlashQuestion(row: RoomMemberReviewReadRow): PracticeQuestion {
  assertSupportedQuestionPayloadSchemaVersion(row.payload_schema_version);
  if (!isRecord(row.public_payload) || !isRecord(row.solution_payload)) {
    throw new Error(`Missing historical question payload (${row.challenge_item_id})`);
  }
  const publicPayload = row.public_payload as Record<string, unknown>;
  const solutionPayload = row.solution_payload as Record<string, unknown>;
  if (row.question_type === "short-text") {
    return shortTextWithSolution(
      readShortText({
        id: row.challenge_item_id,
        payload: publicPayload,
        timeLimitMs: row.time_limit_ms ?? 0,
        points: row.item_points,
        payloadSchemaVersion: row.payload_schema_version,
        mode: row.challenge_mode,
      }),
      {
        challengeItemId: row.challenge_item_id,
        publicPayload,
        solutionPayload,
      },
    );
  }
  if (row.question_type === "mini-wordle") {
    const publicData = isRecord(publicPayload.payload) ? publicPayload.payload : publicPayload;
    const solution = isRecord(solutionPayload.solution)
      ? solutionPayload.solution
      : solutionPayload;
    const solutionData = isRecord(solution.payload) ? solution.payload : solution;
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const prompt =
      typeof publicPayload.prompt === "string" ? publicPayload.prompt : publicData.question;
    const timeLimitMs = row.time_limit_ms ?? publicPayload.timeLimitMs ?? publicData.timeLimitMs;
    const wordLength = publicData.wordLength;
    const maxAttempts = publicData.maxAttempts;
    const correctAnswer = solutionData.correctAnswer;
    const additionalGuesses = solutionData.additionalGuesses;
    if (
      typeof prompt !== "string" ||
      typeof timeLimitMs !== "number" ||
      (wordLength !== 4 && wordLength !== 5) ||
      typeof maxAttempts !== "number" ||
      typeof correctAnswer !== "string" ||
      !Array.isArray(additionalGuesses) ||
      !additionalGuesses.every((value) => typeof value === "string")
    ) {
      throw new Error(`Invalid historical Mini-Wordle payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      ...(typeof publicData.hint === "string" ? { hint: publicData.hint } : {}),
      wordLength,
      maxAttempts,
      correctAnswer,
      additionalGuesses,
      timeLimit: timeLimitMs / 1_000,
      points: row.item_points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
      type: "mini-wordle",
    };
  }
  if (row.question_type === "logic-code") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const clues = publicPayload.clues;
    const codeLength = publicPayload.codeLength;
    const correctAnswer = solutionPayload.correctAnswer;
    const prompt = publicPayload.question;
    const explanation = solutionPayload.explanation;
    if (
      typeof prompt !== "string" ||
      typeof codeLength !== "number" ||
      !Number.isInteger(codeLength) ||
      codeLength < 1 ||
      codeLength > 12 ||
      !Array.isArray(clues) ||
      !clues.every(
        (clue) =>
          isRecord(clue) &&
          typeof clue.code === "string" &&
          typeof clue.hint === "string" &&
          clue.code.length === codeLength,
      ) ||
      typeof correctAnswer !== "string" ||
      correctAnswer.length !== codeLength ||
      typeof explanation !== "string"
    ) {
      throw new Error(`Invalid historical Logic-code payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      clues: clues as { code: string; hint: string }[],
      codeLength,
      correctAnswer,
      timeLimit:
        (row.time_limit_ms ??
          (typeof publicPayload.timeLimitMs === "number" ? publicPayload.timeLimitMs : 0)) / 1_000,
      points: row.item_points,
      explanation,
      type: "logic-code",
    };
  }
  if (row.question_type === "logic-matrix") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const pieces = publicPayload.pieces;
    const cells = publicPayload.cells;
    const optionIds = publicPayload.optionIds;
    const correctOptionId = solutionPayload.correctOptionId;
    const prompt = publicPayload.question;
    if (
      typeof prompt !== "string" ||
      !Array.isArray(pieces) ||
      !pieces.every(
        (piece) =>
          isRecord(piece) &&
          typeof piece.id === "string" &&
          typeof piece.symbol === "string" &&
          typeof piece.label === "string",
      ) ||
      !Array.isArray(cells) ||
      cells.length !== 9 ||
      !Array.isArray(optionIds) ||
      optionIds.length !== 4 ||
      !optionIds.every((optionId) => typeof optionId === "string") ||
      typeof correctOptionId !== "string" ||
      !optionIds.includes(correctOptionId) ||
      (solutionPayload.explanation !== undefined && typeof solutionPayload.explanation !== "string")
    ) {
      throw new Error(`Invalid historical Logic-matrix payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      type: "logic-matrix",
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      pieces: pieces as LogicMatrixQuestion["pieces"],
      cells: cells as LogicMatrixQuestion["cells"],
      optionIds,
      correctOptionId,
      showPieceLabels:
        typeof publicPayload.showPieceLabels === "boolean"
          ? publicPayload.showPieceLabels
          : undefined,
      timeLimit: (row.time_limit_ms ?? 0) / 1000,
      points: row.item_points,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies LogicMatrixQuestion;
  }
  if (row.question_type === "progressive-clues") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const clues = publicPayload.clues;
    const cluePenalty = publicPayload.cluePenalty;
    const correctAnswer = solutionPayload.correctAnswer;
    const acceptedAnswers = solutionPayload.acceptedAnswers;
    const prompt = publicPayload.question;
    const explanation = solutionPayload.explanation;
    if (
      typeof prompt !== "string" ||
      !Array.isArray(clues) ||
      !clues.every((clue) => typeof clue === "string" && clue.trim().length > 0) ||
      typeof cluePenalty !== "number" ||
      !Number.isInteger(cluePenalty) ||
      cluePenalty < 0 ||
      typeof correctAnswer !== "string" ||
      !Array.isArray(acceptedAnswers) ||
      !acceptedAnswers.every((answer) => typeof answer === "string") ||
      typeof explanation !== "string"
    ) {
      throw new Error(`Invalid historical progressive-clues payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      clues,
      cluePenalty,
      correctAnswer,
      acceptedAnswers,
      timeLimit:
        (row.time_limit_ms ??
          (typeof publicPayload.timeLimitMs === "number" ? publicPayload.timeLimitMs : 0)) / 1_000,
      points: row.item_points,
      explanation,
      type: "progressive-clues",
    };
  }
  if (row.question_type === "matching") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const leftItems = publicPayload.leftItems;
    const rightItems = publicPayload.rightItems;
    const matches = solutionPayload.matches;
    const prompt = publicPayload.question;
    const explanation = solutionPayload.explanation;
    if (
      typeof prompt !== "string" ||
      !Array.isArray(leftItems) ||
      !Array.isArray(rightItems) ||
      leftItems.length < 3 ||
      leftItems.length > 6 ||
      rightItems.length !== leftItems.length ||
      !leftItems.every(
        (item) => isRecord(item) && typeof item.id === "string" && typeof item.label === "string",
      ) ||
      !rightItems.every(
        (item) => isRecord(item) && typeof item.id === "string" && typeof item.label === "string",
      ) ||
      !isRecord(matches) ||
      Object.keys(matches).length !== leftItems.length ||
      !leftItems.every((item) => typeof matches[item.id as string] === "string") ||
      new Set(Object.values(matches)).size !== rightItems.length ||
      typeof explanation !== "string"
    ) {
      throw new Error(`Invalid historical matching payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      leftItems: leftItems.map((item) => ({
        id: (item as Record<string, unknown>).id as string,
        label: (item as Record<string, unknown>).label as string,
        ...(typeof (item as Record<string, unknown>).icon === "string"
          ? { icon: (item as Record<string, unknown>).icon as string }
          : {}),
        ...((item as Record<string, unknown>).media
          ? { media: (item as Record<string, unknown>).media as QuestionMedia }
          : {}),
        correctMatchId: matches[(item as Record<string, unknown>).id as string] as string,
      })) as Extract<PracticeQuestion, { type: "matching" }>["leftItems"],
      rightItems: rightItems as Extract<PracticeQuestion, { type: "matching" }>["rightItems"],
      timeLimit:
        (row.time_limit_ms ??
          (typeof publicPayload.timeLimitMs === "number" ? publicPayload.timeLimitMs : 0)) / 1_000,
      points: row.item_points,
      explanation,
      type: "matching",
    };
  }
  if (row.question_type === "true-false") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const prompt = publicPayload.question;
    const correctAnswer = solutionPayload.correctAnswer;
    if (typeof prompt !== "string" || typeof correctAnswer !== "boolean") {
      throw new Error(`Invalid historical true-false payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      correctAnswer,
      timeLimit:
        (row.time_limit_ms ??
          (typeof publicPayload.timeLimitMs === "number" ? publicPayload.timeLimitMs : 0)) / 1_000,
      points: row.item_points,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
      type: "true-false",
    };
  }
  if (row.question_type === "odd-one-out") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const items = publicPayload.items;
    const correctAnswer = solutionPayload.correctAnswer;
    const prompt = publicPayload.question;
    if (
      typeof prompt !== "string" ||
      !Array.isArray(items) ||
      items.length < 3 ||
      items.length > 8 ||
      !items.every(
        (item) => isRecord(item) && typeof item.id === "string" && typeof item.label === "string",
      ) ||
      new Set(items.map((item) => (item as Record<string, unknown>).id as string)).size !==
        items.length ||
      typeof correctAnswer !== "string" ||
      !items.some((item) => (item as Record<string, unknown>).id === correctAnswer)
    ) {
      throw new Error(`Invalid historical odd-one-out payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      items: items as Extract<PracticeQuestion, { type: "odd-one-out" }>["items"],
      correctAnswer,
      timeLimit:
        (row.time_limit_ms ??
          (typeof publicPayload.timeLimitMs === "number" ? publicPayload.timeLimitMs : 0)) / 1_000,
      points: row.item_points,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
      type: "odd-one-out",
    };
  }
  if (row.question_type === "ordering") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const items = publicPayload.items;
    const correctOrder = solutionPayload.correctOrder;
    const prompt = publicPayload.question;
    if (
      typeof prompt !== "string" ||
      !Array.isArray(items) ||
      items.length < 2 ||
      items.length > 8 ||
      !items.every((item) => typeof item === "string") ||
      new Set(items).size !== items.length ||
      !Array.isArray(correctOrder) ||
      correctOrder.length !== items.length ||
      !correctOrder.every((item) => typeof item === "string" && items.includes(item)) ||
      new Set(correctOrder).size !== correctOrder.length
    ) {
      throw new Error(`Invalid historical ordering payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      items,
      correctOrder,
      directionLabels:
        isRecord(publicPayload.directionLabels) &&
        typeof publicPayload.directionLabels.start === "string" &&
        typeof publicPayload.directionLabels.end === "string"
          ? {
              start: publicPayload.directionLabels.start,
              end: publicPayload.directionLabels.end,
            }
          : undefined,
      timeLimit:
        (row.time_limit_ms ??
          (typeof publicPayload.timeLimitMs === "number" ? publicPayload.timeLimitMs : 0)) / 1_000,
      points: row.item_points,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
      type: "ordering",
    };
  }
  if (row.question_type === "estimation") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const prompt = publicPayload.question;
    const configuration = {
      min: publicPayload.min,
      max: publicPayload.max,
      step: publicPayload.step,
      initialValue: publicPayload.initialValue,
      unit: publicPayload.unit,
    };
    const correctAnswer = solutionPayload.correctAnswer;
    const tolerance = solutionPayload.tolerance;
    const media = publicPayload.media;
    const resolvedMedia =
      isRecord(media) && typeof media.src === "string" ? (media as QuestionMedia) : undefined;
    const privateMediaReference = isRecord(media) && typeof media.assetId === "string";
    if (
      typeof prompt !== "string" ||
      !isValidEstimationConfiguration(configuration) ||
      !isValidEstimationSolution(correctAnswer, tolerance, configuration) ||
      !isValidEstimationAnswer(configuration.initialValue, configuration) ||
      (media !== null && media !== undefined && !resolvedMedia && !privateMediaReference)
    ) {
      throw new Error(`Invalid historical estimation payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      type: "estimation",
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      min: configuration.min as number,
      max: configuration.max as number,
      step: configuration.step as number,
      initialValue: configuration.initialValue as number,
      unit: configuration.unit as string,
      ...(resolvedMedia ? { media: resolvedMedia } : {}),
      correctAnswer,
      tolerance: tolerance as number,
      timeLimit: (row.time_limit_ms ?? 0) / 1000,
      points: row.item_points,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies EstimationQuestion;
  }
  if (row.question_type === "heat-map") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const prompt = publicPayload.question;
    const surface = publicPayload.surface;
    const resolvedSurface =
      isRecord(surface) && typeof surface.src === "string" ? surface : undefined;
    const target = solutionPayload.target;
    const fullCreditRadius = solutionPayload.fullCreditRadius;
    const toleranceRadius = solutionPayload.toleranceRadius;
    if (
      typeof prompt !== "string" ||
      !resolvedSurface ||
      typeof resolvedSurface.alt !== "string" ||
      typeof resolvedSurface.width !== "number" ||
      !Number.isSafeInteger(resolvedSurface.width) ||
      resolvedSurface.width <= 0 ||
      typeof resolvedSurface.height !== "number" ||
      !Number.isSafeInteger(resolvedSurface.height) ||
      resolvedSurface.height <= 0 ||
      (resolvedSurface.fit !== undefined &&
        resolvedSurface.fit !== "cover" &&
        resolvedSurface.fit !== "contain") ||
      (resolvedSurface.position !== undefined && typeof resolvedSurface.position !== "string") ||
      typeof publicPayload.targetLabel !== "string" ||
      publicPayload.targetLabel.trim().length === 0 ||
      !isNormalizedPoint(target) ||
      !isValidHeatMapRadii(fullCreditRadius, toleranceRadius)
    ) {
      throw new Error(`Invalid historical heat-map payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      type: "heat-map",
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      surface: resolvedSurface as ImageSurface,
      target,
      targetLabel: publicPayload.targetLabel,
      fullCreditRadius: fullCreditRadius as number,
      toleranceRadius: toleranceRadius as number,
      timeLimit: (row.time_limit_ms ?? 0) / 1000,
      points: row.item_points,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies HeatMapQuestion;
  }
  if (row.question_type === "word-search") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const grid = publicPayload.grid;
    const letters = publicPayload.letters;
    const publicTargets = publicPayload.targets;
    const positions = solutionPayload.positionsByTargetId;
    if (
      typeof publicPayload.question !== "string" ||
      !isRecord(grid) ||
      typeof grid.rows !== "number" ||
      !Number.isInteger(grid.rows) ||
      typeof grid.columns !== "number" ||
      !Number.isInteger(grid.columns) ||
      !Array.isArray(letters) ||
      !Array.isArray(publicTargets) ||
      !isRecord(positions) ||
      !publicTargets.every(
        (target) =>
          isRecord(target) && typeof target.id === "string" && typeof target.word === "string",
      )
    ) {
      throw new Error(`Invalid historical word-search payload (${row.challenge_item_id})`);
    }
    const targets = publicTargets.map((target) => {
      const position = positions[target.id as string];
      if (
        !isRecord(position) ||
        typeof position.startCell !== "number" ||
        typeof position.endCell !== "number"
      ) {
        throw new Error(`Invalid historical word-search solution (${row.challenge_item_id})`);
      }
      return {
        id: target.id as string,
        word: target.word as string,
        startCell: position.startCell as number,
        endCell: position.endCell as number,
      };
    });
    const question = {
      id: row.challenge_item_id,
      type: "word-search" as const,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: typeof publicPayload.question === "string" ? publicPayload.question : "",
      grid: { rows: grid.rows as number, columns: grid.columns as number },
      letters: letters as string[],
      targets,
      timeLimit: (row.time_limit_ms ?? 0) / 1000,
      points: row.item_points,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies WordSearchQuestion;
    if (!isValidWordSearchConfiguration(question)) {
      throw new Error(`Invalid historical word-search payload (${row.challenge_item_id})`);
    }
    return question;
  }
  if (row.question_type === "word-hashtag") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const grid = publicPayload.grid;
    const initialLetters = publicPayload.initialLetters;
    const words = solutionPayload.words;
    if (
      typeof publicPayload.question !== "string" ||
      !isRecord(grid) ||
      grid.rows !== 5 ||
      grid.columns !== 5 ||
      !Array.isArray(initialLetters) ||
      typeof publicPayload.maxMoves !== "number" ||
      !isRecord(words)
    ) {
      throw new Error(`Invalid historical word-hashtag payload (${row.challenge_item_id})`);
    }
    const question = {
      id: row.challenge_item_id,
      type: "word-hashtag" as const,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: publicPayload.question,
      grid: { rows: 5, columns: 5 } as const,
      initialLetters: initialLetters as Array<string | null>,
      maxMoves: publicPayload.maxMoves,
      words: words as WordHashtagQuestion["words"],
      timeLimit: (row.time_limit_ms ?? 0) / 1000,
      points: row.item_points,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies WordHashtagQuestion;
    if (!isValidWordHashtagConfiguration(question)) {
      throw new Error(`Invalid historical word-hashtag payload (${row.challenge_item_id})`);
    }
    return question;
  }
  if (row.question_type === "zip") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const grid = publicPayload.grid;
    const checkpoints = publicPayload.checkpoints;
    const solution = solutionPayload.solution;
    if (
      typeof publicPayload.question !== "string" ||
      !isRecord(grid) ||
      grid.rows !== 5 ||
      grid.columns !== 5 ||
      !Array.isArray(checkpoints) ||
      !Array.isArray(solution)
    ) {
      throw new Error(`Invalid historical zip payload (${row.challenge_item_id})`);
    }
    const question = {
      id: row.challenge_item_id,
      type: "zip" as const,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: publicPayload.question,
      grid: { rows: 5, columns: 5 } as const,
      checkpoints: checkpoints as ZipQuestion["checkpoints"],
      solution: solution as number[],
      instruction:
        typeof publicPayload.instruction === "string" ? publicPayload.instruction : undefined,
      mapNote: typeof publicPayload.mapNote === "string" ? publicPayload.mapNote : undefined,
      boardLabel:
        typeof publicPayload.boardLabel === "string" ? publicPayload.boardLabel : undefined,
      timeLimit: (row.time_limit_ms ?? 0) / 1000,
      points: row.item_points,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies ZipQuestion;
    if (!isValidZipConfiguration(question)) {
      throw new Error(`Invalid historical zip payload (${row.challenge_item_id})`);
    }
    return question;
  }
  if (row.question_type === "escape") {
    const publicPayload = row.public_payload as Record<string, unknown>;
    const solutionPayload = row.solution_payload as Record<string, unknown>;
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const question = {
      id: row.challenge_item_id,
      type: "escape" as const,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: typeof publicPayload.question === "string" ? publicPayload.question : "",
      grid: publicPayload.grid as EscapeQuestion["grid"],
      initialBlocks: publicPayload.initialBlocks as EscapeQuestion["initialBlocks"],
      referenceSolution: solutionPayload.referenceSolution as EscapeQuestion["referenceSolution"],
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
      timeLimit: (row.time_limit_ms ?? 0) / 1000,
      points: row.item_points,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    } satisfies EscapeQuestion;
    if (!isValidEscapeConfiguration(question)) {
      throw new Error(`Invalid historical escape payload (${row.challenge_item_id})`);
    }
    return question;
  }
  if (row.question_type === "anagram") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const prompt = publicPayload.question;
    const tiles = publicPayload.tiles;
    const correctAnswer = solutionPayload.correctAnswer;
    const tileValues = Array.isArray(tiles)
      ? tiles.map((tile) =>
          isRecord(tile) && typeof tile.value === "string" ? normalizeAnswer(tile.value) : "",
        )
      : [];
    const solutionSignature =
      typeof correctAnswer === "string"
        ? Array.from(normalizeAnswer(correctAnswer)).sort().join("")
        : "";
    if (
      typeof prompt !== "string" ||
      !Array.isArray(tiles) ||
      tiles.length < 3 ||
      tiles.length > 10 ||
      !tiles.every(
        (tile) =>
          isRecord(tile) &&
          typeof tile.id === "string" &&
          tile.id.trim().length > 0 &&
          typeof tile.value === "string" &&
          tile.value.trim().length > 0 &&
          Array.from(tile.value).length === 1,
      ) ||
      new Set(tiles.map((tile) => tile.id)).size !== tiles.length ||
      typeof correctAnswer !== "string" ||
      /\s/.test(correctAnswer) ||
      Array.from(correctAnswer).length !== tiles.length ||
      tileValues.sort().join("") !== solutionSignature
    ) {
      throw new Error(`Invalid historical anagram payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      type: "anagram",
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      tiles: tiles as Extract<PracticeQuestion, { type: "anagram" }>["tiles"],
      hint: typeof publicPayload.hint === "string" ? publicPayload.hint : undefined,
      correctAnswer,
      timeLimit: (row.time_limit_ms ?? 0) / 1000,
      points: row.item_points,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (row.question_type === "classification") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const prompt = publicPayload.question;
    const items = publicPayload.items;
    const categories = publicPayload.categories;
    const categoriesByItem = solutionPayload.categoriesByItem;
    const labels = Array.isArray(items)
      ? items.map((item) => (isRecord(item) && typeof item.label === "string" ? item.label : ""))
      : [];
    if (
      typeof prompt !== "string" ||
      !Array.isArray(items) ||
      items.length < 2 ||
      items.length > 20 ||
      !items.every((item) => isRecord(item) && typeof item.label === "string") ||
      labels.some((label) => label.trim().length === 0) ||
      new Set(labels).size !== labels.length ||
      !Array.isArray(categories) ||
      categories.length < 2 ||
      categories.length > 8 ||
      !categories.every((category) => typeof category === "string") ||
      categories.some((category) => category.trim().length === 0) ||
      new Set(categories).size !== categories.length ||
      !isRecord(categoriesByItem) ||
      Object.keys(categoriesByItem).length !== labels.length ||
      Object.keys(categoriesByItem).some((label) => !labels.includes(label)) ||
      items.some(
        (item) =>
          typeof categoriesByItem[item.label as string] !== "string" ||
          !categories.includes(categoriesByItem[item.label as string] as string),
      )
    ) {
      throw new Error(`Invalid historical classification payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      type: "classification",
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      items: items.map((item) => ({
        label: item.label as string,
        correctCategory: categoriesByItem[item.label as string] as string,
      })),
      categories: categories as string[],
      timeLimit: (row.time_limit_ms ?? 0) / 1000,
      points: row.item_points,
      explanation:
        typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    };
  }
  if (row.question_type === "queens") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const grid = publicPayload.grid;
    const regions = publicPayload.regions;
    const prefilledQueens = publicPayload.prefilledQueens;
    const solution = solutionPayload.solution;
    const prompt = publicPayload.question;
    const gridRecord = isRecord(grid) ? grid : null;
    const rows = gridRecord?.rows;
    const columns = gridRecord?.columns;
    const boardGrid = isQueensBoardSize(rows) && rows === columns ? queensGrid(rows) : null;
    const cellCount = boardGrid ? queensCellCount(boardGrid) : 0;
    if (
      typeof prompt !== "string" ||
      !isRecord(grid) ||
      !boardGrid ||
      !Array.isArray(regions) ||
      regions.length !== cellCount ||
      !regions.every(
        (region) =>
          typeof region === "number" &&
          Number.isInteger(region) &&
          region >= 0 &&
          region < boardGrid.rows,
      ) ||
      !Array.isArray(prefilledQueens) ||
      !prefilledQueens.every(
        (cell) =>
          typeof cell === "number" && Number.isInteger(cell) && cell >= 0 && cell < cellCount,
      ) ||
      !Array.isArray(solution) ||
      solution.length !== boardGrid.rows ||
      !solution.every(
        (cell) =>
          typeof cell === "number" && Number.isInteger(cell) && cell >= 0 && cell < cellCount,
      ) ||
      typeof solutionPayload.explanation !== "string"
    ) {
      throw new Error(`Invalid historical Queens payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      grid: boardGrid,
      regions,
      prefilledQueens,
      solution,
      timeLimit:
        (row.time_limit_ms ??
          (typeof publicPayload.timeLimitMs === "number" ? publicPayload.timeLimitMs : 0)) / 1_000,
      points: row.item_points,
      explanation: solutionPayload.explanation,
      type: "queens",
    };
  }
  if (row.question_type === "progressive-image") {
    const tags = requiredRecordField(publicPayload, "tags", "public_payload");
    const surface = publicPayload.surface;
    const revealDurationMs = publicPayload.revealDurationMs;
    const correctAnswer = solutionPayload.correctAnswer;
    const acceptedAnswers = solutionPayload.acceptedAnswers;
    const solutionAlt = solutionPayload.solutionAlt;
    const prompt = publicPayload.question;
    const explanation = solutionPayload.explanation;
    if (
      typeof prompt !== "string" ||
      !isRecord(surface) ||
      typeof surface.src !== "string" ||
      typeof surface.alt !== "string" ||
      typeof surface.width !== "number" ||
      !Number.isInteger(surface.width) ||
      surface.width <= 0 ||
      typeof surface.height !== "number" ||
      !Number.isInteger(surface.height) ||
      surface.height <= 0 ||
      (surface.fit !== undefined && surface.fit !== "cover" && surface.fit !== "contain") ||
      (surface.position !== undefined && typeof surface.position !== "string") ||
      typeof revealDurationMs !== "number" ||
      !Number.isInteger(revealDurationMs) ||
      revealDurationMs <= 0 ||
      (row.time_limit_ms !== undefined && revealDurationMs >= row.time_limit_ms) ||
      typeof correctAnswer !== "string" ||
      !Array.isArray(acceptedAnswers) ||
      !acceptedAnswers.every((answer) => typeof answer === "string") ||
      typeof solutionAlt !== "string" ||
      typeof explanation !== "string"
    ) {
      throw new Error(`Invalid historical progressive-image payload (${row.challenge_item_id})`);
    }
    return {
      id: row.challenge_item_id,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: tags as PracticeQuestion["tags"],
      question: prompt,
      surface: surface as ImageSurface,
      revealDuration: revealDurationMs / 1_000,
      correctAnswer,
      acceptedAnswers,
      solutionAlt,
      ...(typeof publicPayload.answerLabel === "string"
        ? { answerLabel: publicPayload.answerLabel }
        : {}),
      ...(typeof publicPayload.answerPlaceholder === "string"
        ? { answerPlaceholder: publicPayload.answerPlaceholder }
        : {}),
      timeLimit:
        (row.time_limit_ms ??
          (typeof publicPayload.timeLimitMs === "number" ? publicPayload.timeLimitMs : 0)) / 1_000,
      points: row.item_points,
      explanation,
      type: "progressive-image",
    };
  }
  const tags = requiredRecordField(publicPayload, "tags", "public_payload");
  const payload = requiredRecordField(publicPayload, "payload", "public_payload");
  const solution = requiredRecordField(solutionPayload, "solution", "solution_payload");
  const solutionData = requiredRecordField(solution, "payload", "solution_payload.solution");
  const options = payload.options;
  const domains = tags.domains;
  const topics = tags.topics;
  const cognitiveSkills = tags.cognitiveSkills;
  const formatSkills = tags.formatSkills;
  const lifeSkills = tags.lifeSkills ?? [];
  if (
    !Array.isArray(options) ||
    !options.every((value) => typeof value === "string") ||
    !Array.isArray(domains) ||
    !domains.every((value) => typeof value === "string") ||
    !Array.isArray(topics) ||
    !topics.every((value) => typeof value === "string") ||
    !Array.isArray(cognitiveSkills) ||
    !cognitiveSkills.every((value) => typeof value === "string") ||
    !Array.isArray(formatSkills) ||
    !formatSkills.every((value) => typeof value === "string") ||
    !Array.isArray(lifeSkills) ||
    !lifeSkills.every((value) => typeof value === "string")
  ) {
    throw new Error(`Invalid historical Flash payload (${row.challenge_item_id})`);
  }
  const correctAnswer = solutionData.correctAnswer;
  const explanation = solution.explanation;
  if (typeof correctAnswer !== "string" || typeof explanation !== "string") {
    throw new Error(`Invalid historical Flash solution (${row.challenge_item_id})`);
  }
  const prompt = requiredStringField(publicPayload, "prompt", "public_payload");
  const category = requiredStringField(publicPayload, "category", "public_payload");
  const context = publicPayload.context;
  const timeLimitMs = publicPayload.timeLimitMs;
  if (
    (context !== null && typeof context !== "string") ||
    typeof timeLimitMs !== "number" ||
    !Number.isFinite(timeLimitMs)
  ) {
    throw new Error(`Invalid historical Flash timing (${row.challenge_item_id})`);
  }
  return {
    id: row.challenge_item_id,
    category,
    tags: { domains, topics, cognitiveSkills, formatSkills, lifeSkills },
    question: prompt,
    ...(context ? { questionContext: context } : {}),
    timeLimit: timeLimitMs / 1_000,
    points: row.item_points,
    explanation,
    type: "multiple-choice",
    options,
    correctAnswer,
    ...(payload.media ? { media: payload.media as QuestionMedia } : {}),
    ...(payload.promptVisual
      ? { promptVisual: payload.promptVisual as MultipleChoicePromptVisual }
      : {}),
  } as PracticeQuestion;
}

export function toHistoricalChallenge(rows: RoomMemberReviewReadRow[]): PracticeChallenge {
  const first = rows[0];
  if (!first) throw new Error("Cannot build a historical Flash without rows");
  if (first.challenge_mode === "alphabet") {
    const ordered = rows.slice().sort((left, right) => left.item_position - right.item_position);
    if (
      !first.global_time_limit_ms ||
      ordered.length !== first.question_count ||
      new Set(ordered.map((row) => row.alphabet_letter)).size !== ordered.length ||
      ordered.some((row) => row.question_type !== "short-text" || !row.alphabet_letter)
    ) {
      throw new Error("Invalid historical Alphabet configuration");
    }
    return alphabetChallengeWithReview(
      {
        id: first.publication_id,
        definitionId: first.challenge_slug,
        number: 1,
        title: first.challenge_title,
        subtitle: first.challenge_subtitle,
        description: first.challenge_description,
        mode: "alphabet",
        timeLimitMs: first.global_time_limit_ms,
        maxScore: first.challenge_max_score,
        entries: ordered.map((row) => ({
          id: row.challenge_item_id,
          position: row.item_position,
          letter: row.alphabet_letter!,
          questionType: "short-text",
          payloadSchemaVersion: row.payload_schema_version,
          timeLimitMs: row.time_limit_ms ?? 0,
          points: row.item_points,
        })),
      },
      ordered.map((row) => ({
        challengeItemId: row.challenge_item_id,
        publicPayload: row.public_payload,
        solutionPayload: row.solution_payload,
      })),
    );
  }
  const questions = rows
    .slice()
    .sort((left, right) => left.item_position - right.item_position)
    .map(toHistoricalFlashQuestion);
  const questionPoints = Object.fromEntries(
    rows.map((row) => [row.challenge_item_id, row.item_points]),
  );
  if (first.challenge_mode === "survival") {
    return {
      id: first.publication_id,
      definitionId: first.challenge_slug,
      number: 1,
      title: first.challenge_title,
      subtitle: first.challenge_subtitle,
      description: first.challenge_description,
      mode: "survival",
      lives: first.initial_lives ?? 0,
      questions,
      questionPoints,
    };
  }
  if (first.challenge_mode === "narrative") {
    return {
      id: first.publication_id,
      definitionId: first.challenge_slug,
      number: 1,
      title: first.challenge_title,
      subtitle: first.challenge_subtitle,
      description: first.challenge_description,
      mode: "narrative",
      implementationStatus: "complete",
      maxScore: first.challenge_max_score,
      prologue: { id: "historical-prologue", blocks: [] },
      beats: [
        {
          id: "historical-questions",
          title: "Preguntas",
          steps: questions.map((question) => ({ type: "question", question })),
        },
      ],
    } satisfies NarrativeChallenge;
  }
  if (first.challenge_mode !== "flash") {
    throw new Error(`Cannot build a historical ${first.challenge_mode} Challenge`);
  }
  return {
    id: first.publication_id,
    definitionId: first.challenge_slug,
    number: 1,
    title: first.challenge_title,
    subtitle: first.challenge_subtitle,
    description: first.challenge_description,
    mode: "flash",
    questions,
    questionPoints,
  };
}

export function toHistoricalAnswerReview(row: RoomMemberReviewReadRow): AnswerReview {
  const status =
    row.answer_status === "timeout" || row.answer_status === null
      ? "unanswered"
      : row.answer_status;
  return {
    questionId: row.challenge_item_id,
    answer: row.answer as AnswerReview["answer"],
    status,
    isCorrect: status === "correct" || status === "partial",
    points: row.points ?? 0,
    timeUsed: (row.time_used_ms ?? 0) / 1_000,
    ...(row.result_details ? { details: row.result_details as AnswerReview["details"] } : {}),
  };
}

export function toAnswerResult(review: AnswerReview): AnswerResult {
  return {
    questionId: review.questionId,
    answer: review.answer,
    status: review.status,
    isCorrect: review.isCorrect,
    points: review.points ?? 0,
    timeUsed: review.timeUsed ?? 0,
    details: review.details,
  };
}

export function toHistoricalResult(rows: RoomMemberReviewReadRow[]) {
  const first = rows[0];
  if (!first) return null;
  const answers: AnswerReview[] = rows
    .slice()
    .sort((left, right) => left.item_position - right.item_position)
    .map(toHistoricalAnswerReview);
  const durationMs = rows.reduce((total, row) => total + (row.time_used_ms ?? 0), 0);
  const completed = first.attempt_status === "completed";
  return {
    flashPoints: first.attempt_score ?? 0,
    completed,
    attempt: {
      challengeId: first.publication_id,
      startedAt: first.attempt_started_at,
      playedAt: first.attempt_completed_at ?? first.attempt_started_at,
      durationMs: first.attempt_duration_ms ?? durationMs,
      flashPoints: first.attempt_score ?? 0,
      completed,
      answers,
    },
  };
}

export function toRoomMemberReviewItems(rows: RoomMemberReviewReadRow[]): RoomMemberReviewItem[] {
  return rows
    .slice()
    .sort((left, right) => left.item_position - right.item_position)
    .map((row) => {
      const locked = row.challenge_mode === "pyramid" && !row.has_persisted_answer;
      const question = locked ? null : toHistoricalFlashQuestion(row);
      const result = locked ? null : toHistoricalAnswerReview(row);
      const status = locked ? "locked" : (result?.status ?? "unanswered");
      const metadata =
        row.challenge_mode === "pyramid"
          ? {
              levelId: row.level_id ?? undefined,
              label: row.level_label ?? undefined,
              briefing:
                row.briefing_title && row.briefing_format && row.briefing_description
                  ? {
                      title: row.briefing_title,
                      format: row.briefing_format,
                      description: row.briefing_description,
                    }
                  : undefined,
            }
          : row.challenge_mode === "alphabet"
            ? { alphabetLetter: row.alphabet_letter ?? undefined }
            : undefined;
      return {
        id: row.challenge_item_id,
        title:
          row.challenge_mode === "pyramid"
            ? (row.level_label ?? `Nivel ${row.item_position}`)
            : question
              ? QUESTION_FORMAT_LABELS[question.type]
              : row.question_type,
        subtitle:
          row.challenge_mode === "pyramid"
            ? (row.briefing_title ?? `Nivel ${row.item_position}`)
            : (question?.category ?? ""),
        question,
        result,
        status,
        ...(metadata ? { metadata } : {}),
      };
    });
}

export function toRoomMemberReviewProgress(
  rows: RoomMemberReviewReadRow[],
): RoomMemberReviewProgress | null {
  const first = rows[0];
  if (!first) return null;
  const orderedRows = rows.slice().sort((left, right) => left.item_position - right.item_position);
  if (first.challenge_mode === "alphabet") {
    return {
      mode: "alphabet",
      answeredCount: orderedRows.filter((row) => row.has_persisted_answer).length,
      correctCount: orderedRows.filter((row) => row.answer_status === "correct").length,
      totalLetterCount: first.question_count,
    };
  }
  const reviews = orderedRows
    .filter((row) => row.has_persisted_answer || row.challenge_mode === "flash")
    .map(toHistoricalAnswerReview)
    .map(toAnswerResult);
  if (first.challenge_mode === "survival") {
    const progress = deriveSurvivalProgress(
      first.initial_lives ?? 0,
      first.question_count,
      reviews,
    );
    const persistedOutcome =
      first.attempt_outcome === "passed"
        ? "survived"
        : first.attempt_outcome === "failed"
          ? "eliminated"
          : progress.outcome;
    return {
      mode: "survival",
      totalQuestionCount: first.question_count,
      initialLives: first.initial_lives ?? 0,
      ...progress,
      outcome: persistedOutcome,
    };
  }
  if (first.challenge_mode === "pyramid") {
    const progress = deriveCompetitivePyramidProgress(first.question_count, reviews);
    return { mode: "pyramid", totalLevelCount: first.question_count, ...progress };
  }
  if (first.challenge_mode === "narrative") {
    return {
      mode: "narrative",
      answeredCount: orderedRows.filter((row) => row.has_persisted_answer).length,
      totalQuestionCount: first.question_count,
    };
  }
  return {
    mode: "flash",
    answeredCount: orderedRows.filter((row) => row.has_persisted_answer).length,
    totalQuestionCount: first.question_count,
  };
}

export function toHistoricalMember(
  rows: RoomMemberReviewReadRow[],
  fallback: { id: string; name: string; avatarSrc?: string },
): RoomMemberDetailModel["member"] {
  const first = rows[0];
  const name = first?.display_name ?? fallback.name;
  const avatarSrc = resolveAvatarPath(first?.avatar_path) ?? fallback.avatarSrc;
  return {
    id: first?.player_id ?? fallback.id,
    name,
    initials: initials(name),
    avatarSrc: avatarSrc ?? undefined,
    totalFlashPoints: 0,
    challengeResults: {},
  };
}
