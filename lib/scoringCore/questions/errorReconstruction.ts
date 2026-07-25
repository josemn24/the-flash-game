import type {
  AnswerResultDetails,
  AnswerValue,
  ErrorReconstructionAnswer,
  ErrorReconstructionQuestion,
  Question,
} from "@/types/game";
import { normalizeAnswer } from "@/lib/normalizeAnswer";
import { calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

const LOCATION_ONLY_FRACTION = 0.6;

function asQuestion(question: Question): ErrorReconstructionQuestion {
  return question as ErrorReconstructionQuestion;
}

export function isErrorReconstructionAnswer(
  answer: AnswerValue | null,
): answer is ErrorReconstructionAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "stepId" in answer &&
    typeof answer.stepId === "string" &&
    ("correction" in answer
      ? answer.correction === undefined ||
        answer.correction === null ||
        typeof answer.correction === "string"
      : true)
  );
}

export function isValidErrorReconstructionConfiguration(question: ErrorReconstructionQuestion) {
  const stepIds = question.steps.map((step) => step.id);
  if (
    question.steps.length < 3 ||
    question.steps.length > 7 ||
    new Set(stepIds).size !== stepIds.length ||
    !question.steps.every((step) => Boolean(step.id.trim()) && Boolean(step.text.trim())) ||
    !stepIds.includes(question.firstErrorStepId)
  ) {
    return false;
  }

  if (!question.correction) return true;
  const normalizedOptions = question.correction.options.map(normalizeAnswer);
  return (
    question.correction.options.length >= 2 &&
    question.correction.options.length <= 4 &&
    question.correction.options.every((option) => Boolean(option.trim())) &&
    new Set(normalizedOptions).size === normalizedOptions.length &&
    Boolean(question.correction.correctAnswer.trim()) &&
    normalizedOptions.includes(normalizeAnswer(question.correction.correctAnswer))
  );
}

export function calculateErrorReconstructionMetrics(
  question: ErrorReconstructionQuestion,
  answer: ErrorReconstructionAnswer,
) {
  const valid = isValidErrorReconstructionConfiguration(question);
  const selectedStepId = answer.stepId;
  const locationCorrect = valid && selectedStepId === question.firstErrorStepId;
  const correctionRequired = Boolean(question.correction);
  const correctionCorrect =
    locationCorrect &&
    (!question.correction ||
      (typeof answer.correction === "string" &&
        normalizeAnswer(answer.correction) === normalizeAnswer(question.correction.correctAnswer)));
  return { selectedStepId, locationCorrect, correctionRequired, correctionCorrect, valid };
}

function isCorrect(question: Question, answer: AnswerValue) {
  return (
    isErrorReconstructionAnswer(answer) &&
    calculateErrorReconstructionMetrics(asQuestion(question), answer).correctionCorrect
  );
}

function unansweredDetails(question: Question): AnswerResultDetails {
  return {
    type: "error-reconstruction",
    selectedStepId: null,
    locationCorrect: false,
    correctionRequired: Boolean(asQuestion(question).correction),
    correctionCorrect: false,
  };
}

export function evaluateErrorReconstruction({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const errorQuestion = asQuestion(question);
  if (!isErrorReconstructionAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateErrorReconstructionMetrics(errorQuestion, answer);
  if (!metrics.valid || !metrics.locationCorrect) {
    return {
      isCorrect: false,
      status: "incorrect",
      points: 0,
      details: { type: "error-reconstruction", ...metrics },
    };
  }

  const speedMultiplier = calculateSpeedMultiplier(timeUsed, errorQuestion.timeLimit);
  const fraction = errorQuestion.correction
    ? metrics.correctionCorrect
      ? 1
      : LOCATION_ONLY_FRACTION
    : 1;
  const correct = metrics.correctionCorrect;
  return {
    isCorrect: correct,
    status: correct ? "correct" : "partial",
    points: Math.round(errorQuestion.points * fraction * speedMultiplier),
    details: { type: "error-reconstruction", ...metrics },
  };
}

export const scoring = {
  questionType: "error-reconstruction",
  policy: "error-location-correction",
  preserveTimedOutPoints: true,
  isAnswer: isErrorReconstructionAnswer,
  isCorrect,
  evaluate: evaluateErrorReconstruction,
  unansweredDetails,
} as const satisfies QuestionScoring;
