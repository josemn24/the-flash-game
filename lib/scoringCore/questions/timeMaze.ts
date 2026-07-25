import type {
  AnswerResultDetails,
  AnswerValue,
  Question,
  TimeMazeAnswer,
  TimeMazeQuestion,
} from "@/types/game";
import {
  findShortestTimeMazePath,
  getTimeMazeExitIndex,
  isValidTimeMazePath,
} from "@/lib/timeMaze";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): TimeMazeQuestion {
  return question as TimeMazeQuestion;
}

export function isTimeMazeAnswer(answer: AnswerValue | null): answer is TimeMazeAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "path" in answer &&
    Array.isArray(answer.path) &&
    answer.path.length > 0 &&
    answer.path.every((position) => Number.isInteger(position))
  );
}

function isCorrect(question: Question, answer: AnswerValue) {
  const mazeQuestion = asQuestion(question);
  return (
    isTimeMazeAnswer(answer) &&
    isValidTimeMazePath(mazeQuestion, answer.path) &&
    answer.path.at(-1) === getTimeMazeExitIndex(mazeQuestion)
  );
}

function unansweredDetails(question: Question): AnswerResultDetails {
  const mazeQuestion = asQuestion(question);
  return {
    type: "time-maze",
    moves: 0,
    optimalMoves: (findShortestTimeMazePath(mazeQuestion)?.length ?? 1) - 1,
    reachedExit: false,
  };
}

export function evaluateTimeMaze({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const mazeQuestion = asQuestion(question);
  const submittedAnswer = isTimeMazeAnswer(answer) ? answer : null;
  const validPath = submittedAnswer
    ? isValidTimeMazePath(mazeQuestion, submittedAnswer.path)
    : false;
  const reachedExit =
    validPath && submittedAnswer?.path.at(-1) === getTimeMazeExitIndex(mazeQuestion);
  const optimalPath = findShortestTimeMazePath(mazeQuestion);
  const moves = validPath && submittedAnswer ? submittedAnswer.path.length - 1 : 0;
  const optimalMoves = optimalPath ? optimalPath.length - 1 : 0;

  return {
    isCorrect: reachedExit,
    status: reachedExit ? "correct" : "incorrect",
    points: reachedExit ? calculateQuestionScore(mazeQuestion, true, timeUsed) : 0,
    details: { type: "time-maze", moves, optimalMoves, reachedExit },
  };
}

export const scoring = {
  questionType: "time-maze",
  policy: "binary-speed",
  isAnswer: isTimeMazeAnswer,
  isCorrect,
  evaluate: evaluateTimeMaze,
  unansweredDetails,
  timedOutStatus: () => "unanswered",
} as const satisfies QuestionScoring;
