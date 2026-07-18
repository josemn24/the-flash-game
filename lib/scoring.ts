import { normalizeAnswer } from "@/lib/normalizeAnswer";
import type {
  AnswerResult,
  AnswerResultDetails,
  AnswerStatus,
  AnswerValue,
  AssignAllImageLabelingQuestion,
  ClassificationAnswer,
  ClassificationQuestion,
  EstimationQuestion,
  FlashMemoryAnswer,
  FlashMemoryQuestion,
  HeatMapAnswer,
  HeatMapQuestion,
  ImageLabelingAnswer,
  ImageLabelingQuestion,
  LogicCodeQuestion,
  MatchingAnswer,
  MatchingQuestion,
  ProgressiveCluesQuestion,
  Question,
  QuestionType,
  SimonSequenceAnswer,
  SimonSequenceQuestion,
} from "@/types/game";

export type EvaluationInput = {
  question: Question;
  answer: AnswerValue | null;
  timeUsed: number;
  timedOut?: boolean;
  submittedCodes?: string[];
  matchingIncorrectAttempts?: number;
  progressiveCluesRevealed?: number;
};

export type ScoringPolicyId =
  | "binary-speed"
  | "partial-items"
  | "attempt-penalty"
  | "proximity"
  | "clue-speed"
  | "spatial-proximity"
  | "image-labeling";

export const QUESTION_SCORING_POLICY = {
  "multiple-choice": "binary-speed",
  "odd-one-out": "binary-speed",
  matching: "partial-items",
  "true-false": "binary-speed",
  "short-text": "binary-speed",
  "progressive-clues": "clue-speed",
  "heat-map": "spatial-proximity",
  "image-labeling": "image-labeling",
  ordering: "binary-speed",
  classification: "partial-items",
  "flash-memory": "partial-items",
  "simon-sequence": "binary-speed",
  "logic-code": "attempt-penalty",
  estimation: "proximity",
} as const satisfies Record<QuestionType, ScoringPolicyId>;

type InternalEvaluation = {
  isCorrect: boolean;
  status: AnswerStatus;
  points: number;
  details?: AnswerResultDetails;
};

type EvaluationContext = {
  question: Question;
  answer: AnswerValue;
  timeUsed: number;
  submittedCodes: string[];
  incorrectAttempts: number;
  revealedClues: number;
};

function isRecordAnswer(answer: AnswerValue | null): answer is Record<string, string> {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    Object.values(answer).every((value) => typeof value === "string")
  );
}

export function isClassificationAnswer(answer: AnswerValue | null): answer is ClassificationAnswer {
  return isRecordAnswer(answer);
}

export function isMatchingAnswer(answer: AnswerValue | null): answer is MatchingAnswer {
  return isRecordAnswer(answer);
}

export function isFlashMemoryAnswer(answer: AnswerValue | null): answer is FlashMemoryAnswer {
  return isRecordAnswer(answer);
}

export function isSimonSequenceAnswer(answer: AnswerValue | null): answer is SimonSequenceAnswer {
  return Array.isArray(answer) && answer.every((step) => typeof step === "string");
}

export function isHeatMapAnswer(answer: AnswerValue | null): answer is HeatMapAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "x" in answer &&
    "y" in answer &&
    typeof answer.x === "number" &&
    Number.isFinite(answer.x) &&
    typeof answer.y === "number" &&
    Number.isFinite(answer.y)
  );
}

export function isImageLabelingAnswer(answer: AnswerValue | null): answer is ImageLabelingAnswer {
  return isRecordAnswer(answer);
}

function clampTime(timeUsed: number, timeLimit: number) {
  const safeLimit = Math.max(0, timeLimit);
  return Math.min(Math.max(timeUsed, 0), safeLimit);
}

function calculateSpeedMultiplier(timeUsed: number, timeLimit: number) {
  if (timeLimit <= 0) return 0.5;
  return 1 - 0.5 * (clampTime(timeUsed, timeLimit) / timeLimit);
}

function calculateProportionalScore(
  points: number,
  correctItems: number,
  totalItems: number,
  speedMultiplier: number,
) {
  if (totalItems <= 0) return 0;
  return Math.round(points * (correctItems / totalItems) * speedMultiplier);
}

function applyAttemptPenalty(score: number, points: number, incorrectAttempts: number) {
  const penalty = Math.round(points * 0.1) * Math.max(0, incorrectAttempts);
  return Math.max(0, score - penalty);
}

export function calculateMatchingMetrics(question: MatchingQuestion, answer: MatchingAnswer) {
  const correctPairs = question.leftItems.filter(
    (item) => answer[item.id] === item.correctMatchId,
  ).length;
  return { correctPairs, totalPairs: question.leftItems.length };
}

export function isValidFlashMemoryConfiguration(question: FlashMemoryQuestion) {
  const { rows, columns } = question.grid;
  const capacity = rows * columns;
  const itemIds = question.items.map((item) => item.id);
  const positions = question.items.map((item) => item.correctPosition);
  return (
    Number.isInteger(rows) &&
    Number.isInteger(columns) &&
    rows > 0 &&
    columns > 0 &&
    Number.isFinite(question.revealDuration) &&
    question.revealDuration > 0 &&
    question.items.length === capacity &&
    new Set(itemIds).size === itemIds.length &&
    new Set(positions).size === positions.length &&
    question.items.every(
      (item) =>
        Boolean(item.id.trim()) &&
        Boolean(item.label.trim()) &&
        Number.isInteger(item.correctPosition) &&
        item.correctPosition >= 0 &&
        item.correctPosition < capacity,
    )
  );
}

export function calculateFlashMemoryMetrics(
  question: FlashMemoryQuestion,
  answer: FlashMemoryAnswer,
) {
  const capacity = question.grid.rows * question.grid.columns;
  const validPositions = new Set(Array.from({ length: capacity }, (_, index) => String(index)));
  const itemIds = new Set(question.items.map((item) => item.id));
  const entries = Object.entries(answer);
  const assignedItemIds = entries.map(([, itemId]) => itemId);
  const valid =
    isValidFlashMemoryConfiguration(question) &&
    entries.length <= capacity &&
    entries.every(([position, itemId]) => validPositions.has(position) && itemIds.has(itemId)) &&
    new Set(assignedItemIds).size === assignedItemIds.length;
  const correctPlacements = valid
    ? question.items.filter((item) => answer[String(item.correctPosition)] === item.id).length
    : 0;
  return {
    correctPlacements,
    totalPlacements: capacity,
    complete: entries.length === capacity,
    valid,
  };
}

export function isValidSimonSequenceConfiguration(question: SimonSequenceQuestion) {
  const padIds = question.pads.map((pad) => pad.id);
  const padIdSet = new Set(padIds);
  return (
    question.pads.length === 4 &&
    new Set(padIds).size === padIds.length &&
    question.pads.every((pad) => Boolean(pad.id.trim()) && Boolean(pad.label.trim())) &&
    question.sequence.length >= 4 &&
    question.sequence.length <= 6 &&
    question.sequence.every((step) => padIdSet.has(step))
  );
}

export function findSimonSequenceMismatch(sequence: string[], answer: SimonSequenceAnswer) {
  const limit = Math.max(sequence.length, answer.length);
  for (let index = 0; index < limit; index += 1) {
    if (sequence[index] !== answer[index]) return index;
  }
  return null;
}

function isNormalizedPoint(point: { x: number; y: number }) {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

export function isValidImageLabelingConfiguration(question: ImageLabelingQuestion) {
  if (
    !question.surface.src.trim() ||
    !question.surface.alt.trim() ||
    !Number.isFinite(question.surface.width) ||
    question.surface.width <= 0 ||
    !Number.isFinite(question.surface.height) ||
    question.surface.height <= 0
  ) {
    return false;
  }

  if (question.task === "assign-all") {
    const anchorIds = question.anchors.map((anchor) => anchor.id);
    const labelIds = question.labels.map((label) => label.id);
    const labelIdSet = new Set(labelIds);
    return (
      question.anchors.length > 0 &&
      question.labels.length >= question.anchors.length &&
      new Set(anchorIds).size === anchorIds.length &&
      new Set(labelIds).size === labelIds.length &&
      question.anchors.every(
        (anchor) =>
          Boolean(anchor.id.trim()) &&
          isNormalizedPoint(anchor.point) &&
          labelIdSet.has(anchor.correctLabelId),
      ) &&
      question.labels.every((label) => Boolean(label.id.trim()) && Boolean(label.label.trim()))
    );
  }

  if (!isNormalizedPoint(question.target) || !question.response.correctAnswer.trim()) return false;
  if (question.response.kind === "choice") {
    const normalizedOptions = question.response.options.map(normalizeAnswer);
    return (
      question.response.options.length >= 2 &&
      question.response.options.every((option) => Boolean(option.trim())) &&
      new Set(normalizedOptions).size === normalizedOptions.length &&
      normalizedOptions.includes(normalizeAnswer(question.response.correctAnswer))
    );
  }
  if (question.response.acceptedAnswers === undefined) return true;
  const normalizedAnswers = question.response.acceptedAnswers.map(normalizeAnswer);
  return (
    question.response.acceptedAnswers.length > 0 &&
    question.response.acceptedAnswers.every((answer) => Boolean(answer.trim())) &&
    new Set(normalizedAnswers).size === normalizedAnswers.length &&
    normalizedAnswers.includes(normalizeAnswer(question.response.correctAnswer))
  );
}

export function calculateImageLabelingMetrics(
  question: AssignAllImageLabelingQuestion,
  answer: ImageLabelingAnswer,
) {
  const anchorIds = new Set(question.anchors.map((anchor) => anchor.id));
  const labelIds = new Set(question.labels.map((label) => label.id));
  const entries = Object.entries(answer);
  const assignedLabels = entries.map(([, labelId]) => labelId);
  const valid =
    isValidImageLabelingConfiguration(question) &&
    entries.length === question.anchors.length &&
    entries.every(([anchorId, labelId]) => anchorIds.has(anchorId) && labelIds.has(labelId)) &&
    new Set(assignedLabels).size === assignedLabels.length;
  const correctLabels = valid
    ? question.anchors.filter((anchor) => answer[anchor.id] === anchor.correctLabelId).length
    : 0;
  return { correctLabels, totalLabels: question.anchors.length, valid };
}

export function isAnswerCorrect(question: Question, answer: AnswerValue): boolean {
  switch (question.type) {
    case "heat-map":
      return isHeatMapAnswer(answer) && calculateHeatMapMetrics(question, answer).accuracy === 1;
    case "image-labeling":
      if (!isValidImageLabelingConfiguration(question)) return false;
      if (question.task === "assign-all") {
        if (!isImageLabelingAnswer(answer)) return false;
        const labelMetrics = calculateImageLabelingMetrics(question, answer);
        return labelMetrics.valid && labelMetrics.correctLabels === labelMetrics.totalLabels;
      }
      if (typeof answer !== "string") return false;
      const accepted =
        question.response.kind === "text"
          ? (question.response.acceptedAnswers ?? [question.response.correctAnswer])
          : [question.response.correctAnswer];
      return accepted.some((candidate) => normalizeAnswer(candidate) === normalizeAnswer(answer));
    case "estimation":
      return typeof answer === "number" && answer === question.correctAnswer;
    case "classification":
      return (
        isClassificationAnswer(answer) &&
        question.items.every((item) => answer[item.label] === item.correctCategory)
      );
    case "matching":
      return (
        isMatchingAnswer(answer) &&
        calculateMatchingMetrics(question, answer).correctPairs === question.leftItems.length
      );
    case "flash-memory": {
      if (!isFlashMemoryAnswer(answer)) return false;
      const metrics = calculateFlashMemoryMetrics(question, answer);
      return (
        metrics.valid && metrics.complete && metrics.correctPlacements === question.items.length
      );
    }
    case "simon-sequence":
      return (
        isSimonSequenceAnswer(answer) &&
        isValidSimonSequenceConfiguration(question) &&
        answer.length === question.sequence.length &&
        findSimonSequenceMismatch(question.sequence, answer) === null
      );
    case "ordering":
      return (
        Array.isArray(answer) &&
        answer.length === question.correctOrder.length &&
        answer.every((item, index) => item === question.correctOrder[index])
      );
    case "true-false":
      return answer === question.correctAnswer;
    default: {
      if (typeof answer !== "string") return false;
      const accepted =
        question.type === "short-text" || question.type === "progressive-clues"
          ? (question.acceptedAnswers ?? [question.correctAnswer])
          : [question.correctAnswer];
      const normalizedAnswer = normalizeAnswer(answer);
      return accepted.some((candidate) => normalizeAnswer(candidate) === normalizedAnswer);
    }
  }
}

function clampNormalizedCoordinate(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function safeNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateHeatMapMetrics(question: HeatMapQuestion, answer: HeatMapAnswer) {
  const selectedPoint = {
    x: clampNormalizedCoordinate(answer.x),
    y: clampNormalizedCoordinate(answer.y),
  };
  const targetPoint = {
    x: clampNormalizedCoordinate(question.target.x),
    y: clampNormalizedCoordinate(question.target.y),
  };
  const width = Math.max(1, safeNonNegative(Math.abs(question.surface.width)));
  const height = Math.max(1, safeNonNegative(Math.abs(question.surface.height)));
  const shortSide = Math.min(width, height);
  const distance = Math.hypot(
    (selectedPoint.x - targetPoint.x) * (width / shortSide),
    (selectedPoint.y - targetPoint.y) * (height / shortSide),
  );
  const fullCreditRadius = safeNonNegative(question.fullCreditRadius);
  const toleranceRadius = Math.max(fullCreditRadius, safeNonNegative(question.toleranceRadius));
  const accuracy =
    distance <= fullCreditRadius
      ? 1
      : toleranceRadius <= fullCreditRadius || distance >= toleranceRadius
        ? 0
        : 1 - (distance - fullCreditRadius) / (toleranceRadius - fullCreditRadius);

  return { selectedPoint, targetPoint, distance, accuracy };
}

function clampRevealedClues(revealedClues: number, totalClues: number) {
  if (totalClues <= 0) return 0;
  const safeValue = Number.isFinite(revealedClues) ? Math.trunc(revealedClues) : 1;
  return Math.min(Math.max(safeValue, 1), totalClues);
}

export function calculateProgressiveCluesMetrics(
  question: ProgressiveCluesQuestion,
  revealedClues: number,
) {
  const totalClues = question.clues.length;
  const safeRevealedClues = clampRevealedClues(revealedClues, totalClues);
  const additionalClues = Math.max(0, safeRevealedClues - 1);
  const availablePoints = Math.max(0, question.points - question.cluePenalty * additionalClues);
  return { revealedClues: safeRevealedClues, totalClues, availablePoints };
}

export function calculateEstimationMetrics(question: EstimationQuestion, answer: number) {
  const difference = Math.abs(answer - question.correctAnswer);
  const proximity =
    question.tolerance <= 0
      ? Number(difference === 0)
      : Math.min(1, Math.max(0, 1 - difference / question.tolerance));
  return { difference, proximity };
}

export function calculateQuestionScore(question: Question, correct: boolean, timeUsed: number) {
  if (correct) {
    const score = Math.round(
      question.points * calculateSpeedMultiplier(timeUsed, question.timeLimit),
    );
    return Math.max(score, Math.ceil(question.points * 0.5));
  }

  if (question.type === "true-false") return -Math.round(question.points * 0.4);
  if (
    question.type === "multiple-choice" ||
    question.type === "odd-one-out" ||
    question.type === "ordering"
  ) {
    return -Math.round(question.points * 0.2);
  }
  return 0;
}

function evaluateBinarySpeed({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: calculateQuestionScore(question, isCorrect, timeUsed),
  };
}

function evaluateClassification(
  question: ClassificationQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  if (!isClassificationAnswer(answer)) {
    return { isCorrect, status: "incorrect", points: 0 };
  }

  const correctItems = question.items.filter(
    (item) => answer[item.label] === item.correctCategory,
  ).length;
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: calculateProportionalScore(
      question.points,
      correctItems,
      question.items.length,
      calculateSpeedMultiplier(timeUsed, question.timeLimit),
    ),
  };
}

function evaluateMatching(
  question: MatchingQuestion,
  answer: AnswerValue,
  timeUsed: number,
  incorrectAttempts: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  if (!isMatchingAnswer(answer)) {
    return { isCorrect, status: "incorrect", points: 0 };
  }

  const metrics = calculateMatchingMetrics(question, answer);
  const partialScore = calculateProportionalScore(
    question.points,
    metrics.correctPairs,
    metrics.totalPairs,
    calculateSpeedMultiplier(timeUsed, question.timeLimit),
  );
  return {
    isCorrect,
    status: isCorrect ? "correct" : metrics.correctPairs > 0 ? "partial" : "incorrect",
    points: applyAttemptPenalty(partialScore, question.points, incorrectAttempts),
    details: { type: "matching", ...metrics, incorrectAttempts },
  };
}

function evaluateFlashMemory(
  question: FlashMemoryQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  if (!isFlashMemoryAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateFlashMemoryMetrics(question, answer);
  const isCorrect = metrics.valid && metrics.correctPlacements === metrics.totalPlacements;
  return {
    isCorrect,
    status: isCorrect ? "correct" : metrics.correctPlacements > 0 ? "partial" : "incorrect",
    points: calculateProportionalScore(
      question.points,
      metrics.correctPlacements,
      metrics.totalPlacements,
      calculateSpeedMultiplier(timeUsed, question.timeLimit),
    ),
    details: {
      type: "flash-memory",
      correctPlacements: metrics.correctPlacements,
      totalPlacements: metrics.totalPlacements,
    },
  };
}

function evaluateSimonSequence(
  question: SimonSequenceQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  const submittedSteps = isSimonSequenceAnswer(answer) ? answer : [];
  const isCorrect = isAnswerCorrect(question, answer);
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: isCorrect ? calculateQuestionScore(question, true, timeUsed) : 0,
    details: {
      type: "simon-sequence",
      submittedSteps,
      firstMismatchIndex: findSimonSequenceMismatch(question.sequence, submittedSteps),
    },
  };
}

function evaluateImageLabeling(
  question: ImageLabelingQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  if (!isValidImageLabelingConfiguration(question)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  if (question.task === "identify-one") {
    if (typeof answer !== "string") {
      return { isCorrect: false, status: "incorrect", points: 0 };
    }
    const isCorrect = isAnswerCorrect(question, answer);
    return {
      isCorrect,
      status: isCorrect ? "correct" : "incorrect",
      points: isCorrect
        ? calculateQuestionScore(question, true, timeUsed)
        : question.response.kind === "choice"
          ? -Math.round(question.points * 0.2)
          : 0,
      details: {
        type: "image-labeling",
        task: "identify-one",
        responseKind: question.response.kind,
      },
    };
  }

  if (!isImageLabelingAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateImageLabelingMetrics(question, answer);
  if (!metrics.valid) {
    return {
      isCorrect: false,
      status: "incorrect",
      points: 0,
      details: {
        type: "image-labeling",
        task: "assign-all",
        correctLabels: 0,
        totalLabels: metrics.totalLabels,
      },
    };
  }

  const isCorrect = metrics.correctLabels === metrics.totalLabels;
  return {
    isCorrect,
    status: isCorrect ? "correct" : metrics.correctLabels > 0 ? "partial" : "incorrect",
    points: calculateProportionalScore(
      question.points,
      metrics.correctLabels,
      metrics.totalLabels,
      calculateSpeedMultiplier(timeUsed, question.timeLimit),
    ),
    details: {
      type: "image-labeling",
      task: "assign-all",
      correctLabels: metrics.correctLabels,
      totalLabels: metrics.totalLabels,
    },
  };
}

function evaluateEstimation(
  question: EstimationQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  if (typeof answer !== "number") {
    return { isCorrect, status: "partial", points: 0 };
  }

  const metrics = calculateEstimationMetrics(question, answer);
  return {
    isCorrect,
    status: isCorrect ? "correct" : "partial",
    points: Math.max(
      0,
      Math.round(
        question.points *
          metrics.proximity *
          calculateSpeedMultiplier(timeUsed, question.timeLimit),
      ),
    ),
    details: { type: "estimation", ...metrics },
  };
}

function evaluateLogicCode(
  question: LogicCodeQuestion,
  answer: AnswerValue,
  timeUsed: number,
  submittedCodes: string[],
  incorrectAttempts: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  const speedScore = isCorrect ? calculateQuestionScore(question, true, timeUsed) : 0;
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: applyAttemptPenalty(speedScore, question.points, incorrectAttempts),
    details: { type: "logic-code", submittedCodes, incorrectAttempts },
  };
}

function evaluateProgressiveClues(
  question: ProgressiveCluesQuestion,
  answer: AnswerValue,
  timeUsed: number,
  revealedClues: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  const metrics = calculateProgressiveCluesMetrics(question, revealedClues);
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: isCorrect
      ? Math.round(metrics.availablePoints * calculateSpeedMultiplier(timeUsed, question.timeLimit))
      : 0,
    details: { type: "progressive-clues", ...metrics },
  };
}

function evaluateHeatMap(
  question: HeatMapQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  if (!isHeatMapAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateHeatMapMetrics(question, answer);
  const isCorrect = metrics.accuracy === 1;
  return {
    isCorrect,
    status: isCorrect ? "correct" : metrics.accuracy > 0 ? "partial" : "incorrect",
    points: Math.max(
      0,
      Math.round(
        question.points * metrics.accuracy * calculateSpeedMultiplier(timeUsed, question.timeLimit),
      ),
    ),
    details: {
      type: "heat-map",
      ...metrics,
    },
  };
}

function evaluateByPolicy(context: EvaluationContext): InternalEvaluation {
  const { question, answer, timeUsed, submittedCodes, incorrectAttempts, revealedClues } = context;

  switch (QUESTION_SCORING_POLICY[question.type]) {
    case "binary-speed":
      if (question.type === "simon-sequence") {
        return evaluateSimonSequence(question, answer, timeUsed);
      }
      return evaluateBinarySpeed(context);
    case "partial-items":
      if (question.type === "classification") {
        return evaluateClassification(question, answer, timeUsed);
      }
      if (question.type === "matching") {
        return evaluateMatching(question, answer, timeUsed, incorrectAttempts);
      }
      if (question.type === "flash-memory") {
        return evaluateFlashMemory(question, answer, timeUsed);
      }
      throw new Error(`Unsupported partial-items question: ${question.type}`);
    case "attempt-penalty": {
      if (question.type !== "logic-code") {
        throw new Error(`Unsupported attempt-penalty question: ${question.type}`);
      }
      return evaluateLogicCode(question, answer, timeUsed, submittedCodes, incorrectAttempts);
    }
    case "proximity": {
      if (question.type !== "estimation") {
        throw new Error(`Unsupported proximity question: ${question.type}`);
      }
      return evaluateEstimation(question, answer, timeUsed);
    }
    case "clue-speed": {
      if (question.type !== "progressive-clues") {
        throw new Error(`Unsupported clue-speed question: ${question.type}`);
      }
      return evaluateProgressiveClues(question, answer, timeUsed, revealedClues);
    }
    case "spatial-proximity": {
      if (question.type !== "heat-map") {
        throw new Error(`Unsupported spatial-proximity question: ${question.type}`);
      }
      return evaluateHeatMap(question, answer, timeUsed);
    }
    case "image-labeling": {
      if (question.type !== "image-labeling") {
        throw new Error(`Unsupported image-labeling question: ${question.type}`);
      }
      return evaluateImageLabeling(question, answer, timeUsed);
    }
  }
}

export function calculateAnswerScore(
  question: Question,
  answer: AnswerValue,
  timeUsed: number,
  incorrectAttempts = 0,
  revealedClues = 1,
) {
  return evaluateByPolicy({
    question,
    answer,
    timeUsed: clampTime(timeUsed, question.timeLimit),
    submittedCodes: [],
    incorrectAttempts,
    revealedClues,
  }).points;
}

export function evaluateAnswer({
  question,
  answer,
  timeUsed,
  timedOut = false,
  submittedCodes = [],
  matchingIncorrectAttempts = 0,
  progressiveCluesRevealed = 1,
}: EvaluationInput): AnswerResult {
  const safeTime = clampTime(timeUsed, question.timeLimit);
  if (answer === null) {
    return {
      questionId: question.id,
      answer,
      status: "unanswered",
      isCorrect: false,
      points: 0,
      timeUsed: safeTime,
      ...(question.type === "logic-code"
        ? {
            details: {
              type: "logic-code" as const,
              submittedCodes,
              incorrectAttempts: submittedCodes.length,
            },
          }
        : question.type === "progressive-clues"
          ? {
              details: {
                type: "progressive-clues" as const,
                ...calculateProgressiveCluesMetrics(question, progressiveCluesRevealed),
              },
            }
          : question.type === "simon-sequence"
            ? {
                details: {
                  type: "simon-sequence" as const,
                  submittedSteps: [],
                  firstMismatchIndex: null,
                },
              }
            : {}),
    };
  }

  const isCorrect = isAnswerCorrect(question, answer);
  const incorrectAttempts =
    question.type === "logic-code" ? Math.max(0, submittedCodes.length - (isCorrect ? 1 : 0)) : 0;
  const evaluation = evaluateByPolicy({
    question,
    answer,
    timeUsed: safeTime,
    submittedCodes,
    incorrectAttempts: question.type === "matching" ? matchingIncorrectAttempts : incorrectAttempts,
    revealedClues: question.type === "progressive-clues" ? progressiveCluesRevealed : 1,
  });

  const matchingWithoutProgress =
    timedOut && evaluation.details?.type === "matching" && evaluation.details.correctPairs === 0;
  const discardedSpatialDraft =
    timedOut && (question.type === "heat-map" || question.type === "image-labeling");

  return {
    questionId: question.id,
    answer,
    ...evaluation,
    status: matchingWithoutProgress || discardedSpatialDraft ? "unanswered" : evaluation.status,
    points:
      timedOut && question.type !== "matching" && question.type !== "flash-memory"
        ? 0
        : evaluation.points,
    timeUsed: safeTime,
  };
}

export function calculateTotalScore(scores: number[]) {
  return Math.max(
    0,
    scores.reduce((total, score) => total + score, 0),
  );
}
