import type {
  AnswerResultDetails,
  AnswerValue,
  EscapeAnswer,
  EscapeQuestion,
  Question,
} from "@/types/game";
import { isEscapeAnswer, isValidEscapeConfiguration, replayEscapeMoves } from "@/lib/escape";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question) {
  return question as EscapeQuestion;
}

function detailsFor(question: EscapeQuestion, answer: EscapeAnswer): AnswerResultDetails {
  const replay = replayEscapeMoves(question, answer.moves);
  return {
    type: "escape",
    moves: replay.appliedMoves,
    optimalMoves: question.optimalMoves,
    escaped: replay.valid && replay.escaped,
  };
}

function unansweredDetails(question: Question): AnswerResultDetails {
  return {
    type: "escape",
    moves: 0,
    optimalMoves: asQuestion(question).optimalMoves,
    escaped: false,
  };
}

function isCorrect(question: Question, answer: AnswerValue) {
  if (!isEscapeAnswer(answer)) return false;
  const escapeQuestion = asQuestion(question);
  if (!isValidEscapeConfiguration(escapeQuestion)) return false;
  const replay = replayEscapeMoves(escapeQuestion, answer.moves);
  return replay.valid && replay.escaped;
}

export function evaluateEscape({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const escapeQuestion = asQuestion(question);
  if (!isEscapeAnswer(answer) || !isValidEscapeConfiguration(escapeQuestion)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const replay = replayEscapeMoves(escapeQuestion, answer.moves);
  const escaped = replay.valid && replay.escaped;
  return {
    isCorrect: escaped,
    status: escaped ? "correct" : "incorrect",
    points: escaped ? calculateQuestionScore(escapeQuestion, true, timeUsed) : 0,
    details: detailsFor(escapeQuestion, answer),
  };
}

export const scoring = {
  questionType: "escape",
  policy: "binary-speed",
  timeoutPolicy: {
    answerSource: "draft",
    unansweredDetails,
    status: () => "unanswered",
  },
  isAnswer: isEscapeAnswer,
  isCorrect,
  evaluate: evaluateEscape,
} as const satisfies QuestionScoring;
