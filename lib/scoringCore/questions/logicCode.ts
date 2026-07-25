import type { AnswerResultDetails, AnswerValue, LogicCodeQuestion, Question } from "@/types/game";
import { applyAttemptPenalty, calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): LogicCodeQuestion {
  return question as LogicCodeQuestion;
}

function isCorrect(question: Question, answer: AnswerValue) {
  return typeof answer === "string" && answer === asQuestion(question).correctAnswer;
}

function unansweredDetails(
  _question: Question,
  context: { submittedCodes: string[] },
): AnswerResultDetails {
  return {
    type: "logic-code",
    submittedCodes: context.submittedCodes,
    incorrectAttempts: context.submittedCodes.length,
  };
}

export function evaluateLogicCode({
  question,
  answer,
  timeUsed,
  submittedCodes,
  incorrectAttempts,
}: EvaluationContext): InternalEvaluation {
  const logicQuestion = asQuestion(question);
  const correct = isCorrect(question, answer);
  const speedScore = correct ? calculateQuestionScore(logicQuestion, true, timeUsed) : 0;
  return {
    isCorrect: correct,
    status: correct ? "correct" : "incorrect",
    points: applyAttemptPenalty(speedScore, logicQuestion.points, incorrectAttempts),
    details: { type: "logic-code", submittedCodes, incorrectAttempts },
  };
}

export const scoring = {
  questionType: "logic-code",
  policy: "attempt-penalty",
  timeoutAnswerSource: "last-submitted-code",
  isAnswer: (answer) => typeof answer === "string",
  isCorrect,
  buildEvaluationContext: (input) => ({
    question: input.question,
    answer: input.answer,
    timeUsed: input.timeUsed,
    submittedCodes: input.submittedCodes,
    incorrectAttempts:
      input.submittedCodes.length > 0
        ? Math.max(0, input.submittedCodes.length - (input.isCorrect ? 1 : 0))
        : input.incorrectAttempts,
    revealedClues: 1,
  }),
  evaluate: evaluateLogicCode,
  unansweredDetails,
} as const satisfies QuestionScoring;
