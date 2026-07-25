import type {
  AnswerValue,
  AssignAllImageLabelingQuestion,
  ImageLabelingAnswer,
  ImageLabelingQuestion,
  Question,
} from "@/types/game";
import { normalizeAnswer } from "@/lib/normalizeAnswer";
import {
  CHOICE_PENALTY_RATIO,
  calculateProportionalScore,
  calculateQuestionScore,
  calculateSpeedMultiplier,
} from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): ImageLabelingQuestion {
  return question as ImageLabelingQuestion;
}

function isRecordAnswer(answer: AnswerValue | null): answer is ImageLabelingAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    !("stepId" in answer) &&
    Object.values(answer).every((value) => typeof value === "string")
  );
}

export function isImageLabelingAnswer(answer: AnswerValue | null): answer is ImageLabelingAnswer {
  return isRecordAnswer(answer);
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

function identifyOneIsCorrect(question: ImageLabelingQuestion, answer: string) {
  if (question.task !== "identify-one") return false;
  const accepted =
    question.response.kind === "text"
      ? (question.response.acceptedAnswers ?? [question.response.correctAnswer])
      : [question.response.correctAnswer];
  return accepted.some((candidate) => normalizeAnswer(candidate) === normalizeAnswer(answer));
}

function isCorrect(question: Question, answer: AnswerValue) {
  const imageQuestion = asQuestion(question);
  if (!isValidImageLabelingConfiguration(imageQuestion)) return false;
  if (imageQuestion.task === "assign-all") {
    if (!isImageLabelingAnswer(answer)) return false;
    const labelMetrics = calculateImageLabelingMetrics(imageQuestion, answer);
    return labelMetrics.valid && labelMetrics.correctLabels === labelMetrics.totalLabels;
  }
  return typeof answer === "string" && identifyOneIsCorrect(imageQuestion, answer);
}

export function evaluateImageLabeling({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const imageQuestion = asQuestion(question);
  if (!isValidImageLabelingConfiguration(imageQuestion)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  if (imageQuestion.task === "identify-one") {
    if (typeof answer !== "string") {
      return { isCorrect: false, status: "incorrect", points: 0 };
    }
    const correct = identifyOneIsCorrect(imageQuestion, answer);
    return {
      isCorrect: correct,
      status: correct ? "correct" : "incorrect",
      points: correct
        ? calculateQuestionScore(imageQuestion, true, timeUsed)
        : imageQuestion.response.kind === "choice"
          ? -Math.round(imageQuestion.points * CHOICE_PENALTY_RATIO)
          : 0,
      details: {
        type: "image-labeling",
        task: "identify-one",
        responseKind: imageQuestion.response.kind,
      },
    };
  }

  if (!isImageLabelingAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateImageLabelingMetrics(imageQuestion, answer);
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

  const correct = metrics.correctLabels === metrics.totalLabels;
  return {
    isCorrect: correct,
    status: correct ? "correct" : metrics.correctLabels > 0 ? "partial" : "incorrect",
    points: calculateProportionalScore(
      imageQuestion.points,
      metrics.correctLabels,
      metrics.totalLabels,
      calculateSpeedMultiplier(timeUsed, imageQuestion.timeLimit),
    ),
    details: {
      type: "image-labeling",
      task: "assign-all",
      correctLabels: metrics.correctLabels,
      totalLabels: metrics.totalLabels,
    },
  };
}

export const scoring = {
  questionType: "image-labeling",
  policy: "image-labeling",
  isAnswer: (answer) => isImageLabelingAnswer(answer) || typeof answer === "string",
  isCorrect,
  evaluate: evaluateImageLabeling,
  timedOutStatus: () => "unanswered",
} as const satisfies QuestionScoring;
