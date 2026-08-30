import type {
  AnswerResultDetails,
  AnswerValue,
  Question,
  ZipAnswer,
  ZipQuestion,
} from "@/types/game";
import { calculateZipMetrics, isValidZipAnswer, isValidZipConfiguration } from "@/lib/zip";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): ZipQuestion {
  return question as ZipQuestion;
}

export function isZipAnswer(answer: AnswerValue | null): answer is ZipAnswer {
  return isValidZipAnswer(answer);
}

function detailsFor(question: ZipQuestion, answer: ZipAnswer): AnswerResultDetails {
  const metrics = calculateZipMetrics(question, answer);
  return {
    type: "zip",
    coveredCells: metrics.coveredCells,
    totalCells: metrics.totalCells,
    reachedCheckpoint: metrics.reachedCheckpoint,
    totalCheckpoints: metrics.totalCheckpoints,
    completed: metrics.completed,
  };
}

function unansweredDetails(question: Question): AnswerResultDetails {
  const zipQuestion = asQuestion(question);
  return {
    type: "zip",
    coveredCells: 1,
    totalCells: zipQuestion.grid.rows * zipQuestion.grid.columns,
    reachedCheckpoint: 1,
    totalCheckpoints: zipQuestion.checkpoints.length,
    completed: false,
  };
}

function isCorrect(question: Question, answer: AnswerValue) {
  if (!isZipAnswer(answer)) return false;
  const zipQuestion = asQuestion(question);
  return isValidZipConfiguration(zipQuestion) && calculateZipMetrics(zipQuestion, answer).completed;
}

export function evaluateZip({ question, answer, timeUsed }: EvaluationContext): InternalEvaluation {
  const zipQuestion = asQuestion(question);
  if (!isZipAnswer(answer) || !isValidZipConfiguration(zipQuestion)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateZipMetrics(zipQuestion, answer);
  const details = detailsFor(zipQuestion, answer);
  if (!metrics.valid) {
    return { isCorrect: false, status: "incorrect", points: 0, details };
  }
  if (!metrics.completed) {
    return {
      isCorrect: false,
      status: metrics.coveredCells > 1 ? "partial" : "unanswered",
      points: 0,
      details,
    };
  }

  return {
    isCorrect: true,
    status: "correct",
    points: calculateQuestionScore(zipQuestion, true, timeUsed),
    details,
  };
}

export const scoring = {
  questionType: "zip",
  policy: "binary-speed",
  timeoutPolicy: {
    answerSource: "draft",
    unansweredDetails,
    status: (evaluation) =>
      evaluation.details?.type === "zip" && evaluation.details.coveredCells <= 1
        ? "unanswered"
        : undefined,
  },
  isAnswer: isZipAnswer,
  isCorrect,
  evaluate: evaluateZip,
} as const satisfies QuestionScoring;
