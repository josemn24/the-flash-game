import type {
  AnswerResultDetails,
  AnswerValue,
  Question,
  SimonSequenceAnswer,
  SimonSequenceQuestion,
} from "@/types/game";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): SimonSequenceQuestion {
  return question as SimonSequenceQuestion;
}

export function isSimonSequenceAnswer(answer: AnswerValue | null): answer is SimonSequenceAnswer {
  return Array.isArray(answer) && answer.every((step) => typeof step === "string");
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

function isCorrect(question: Question, answer: AnswerValue) {
  const simonQuestion = asQuestion(question);
  return (
    isSimonSequenceAnswer(answer) &&
    isValidSimonSequenceConfiguration(simonQuestion) &&
    answer.length === simonQuestion.sequence.length &&
    findSimonSequenceMismatch(simonQuestion.sequence, answer) === null
  );
}

function unansweredDetails(): AnswerResultDetails {
  return {
    type: "simon-sequence",
    submittedSteps: [],
    firstMismatchIndex: null,
  };
}

export function evaluateSimonSequence({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const simonQuestion = asQuestion(question);
  const submittedSteps = isSimonSequenceAnswer(answer) ? answer : [];
  const correct = isCorrect(question, answer);
  return {
    isCorrect: correct,
    status: correct ? "correct" : "incorrect",
    points: correct ? calculateQuestionScore(simonQuestion, true, timeUsed) : 0,
    details: {
      type: "simon-sequence",
      submittedSteps,
      firstMismatchIndex: findSimonSequenceMismatch(simonQuestion.sequence, submittedSteps),
    },
  };
}

export const scoring = {
  questionType: "simon-sequence",
  policy: "binary-speed",
  isAnswer: isSimonSequenceAnswer,
  isCorrect,
  evaluate: evaluateSimonSequence,
  unansweredDetails,
} as const satisfies QuestionScoring;
