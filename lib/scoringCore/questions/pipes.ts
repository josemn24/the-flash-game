import type {
  AnswerResultDetails,
  AnswerValue,
  PipesAnswer,
  PipesQuestion,
  Question,
} from "@/types/game";
import { calculatePipesMetrics, isPipesAnswer, isValidPipesConfiguration } from "@/lib/pipes";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question) {
  return question as PipesQuestion;
}

function detailsFor(question: PipesQuestion, answer: PipesAnswer): AnswerResultDetails {
  const metrics = calculatePipesMetrics(question, answer);
  return {
    type: "pipes",
    connectedTiles: metrics.connectedTiles,
    totalTiles: metrics.totalTiles,
    openConnections: metrics.openConnections,
    isolatedComponents: metrics.isolatedComponents,
    moves: answer.moves,
    solved: metrics.solved,
  };
}

function unansweredDetails(question: Question): AnswerResultDetails {
  const pipesQuestion = asQuestion(question);
  return {
    type: "pipes",
    connectedTiles: 0,
    totalTiles: pipesQuestion.grid.rows * pipesQuestion.grid.columns,
    openConnections: 0,
    isolatedComponents: 0,
    moves: 0,
    solved: false,
  };
}

function isCorrect(question: Question, answer: AnswerValue) {
  return (
    isPipesAnswer(answer) &&
    isValidPipesConfiguration(asQuestion(question)) &&
    calculatePipesMetrics(asQuestion(question), answer).solved
  );
}

export function evaluatePipes({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const pipesQuestion = asQuestion(question);
  if (!isPipesAnswer(answer) || !isValidPipesConfiguration(pipesQuestion)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }
  const metrics = calculatePipesMetrics(pipesQuestion, answer);
  return {
    isCorrect: metrics.solved,
    status: metrics.solved ? "correct" : answer.moves > 0 ? "partial" : "unanswered",
    points: metrics.solved ? calculateQuestionScore(pipesQuestion, true, timeUsed) : 0,
    details: detailsFor(pipesQuestion, answer),
  };
}

export const scoring = {
  questionType: "pipes",
  policy: "binary-speed",
  timeoutPolicy: {
    answerSource: "draft",
    unansweredDetails,
    status: (evaluation) =>
      evaluation.details?.type === "pipes" && evaluation.details.moves === 0
        ? "unanswered"
        : undefined,
  },
  isAnswer: isPipesAnswer,
  isCorrect,
  evaluate: evaluatePipes,
} as const satisfies QuestionScoring;
