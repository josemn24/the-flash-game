import { getChallengeById } from "@/data/challenges";
import { evaluateAnswer } from "@/lib/scoring";
import type {
  AnswerValue,
  Challenge,
  Question,
  RoomChallengeAttempt,
  RoomChallengeResult,
} from "@/types/game";

function answerFor(question: Question): AnswerValue | null {
  switch (question.type) {
    case "multiple-choice":
    case "odd-one-out":
    case "true-false":
    case "short-text":
    case "progressive-clues":
    case "progressive-image":
    case "logic-code":
    case "estimation":
    case "anagram":
    case "mini-wordle":
      return question.correctAnswer;
    case "logic-matrix":
      return question.correctOptionId;
    case "ordering":
      return question.correctOrder;
    case "classification":
      return Object.fromEntries(question.items.map((item) => [item.label, item.correctCategory]));
    case "matching":
      return Object.fromEntries(question.leftItems.map((item) => [item.id, item.correctMatchId]));
    case "connect-pairs":
      return { paths: question.solutionPaths };
    case "flash-memory":
      return Object.fromEntries(question.items.map((item) => [item.id, String(item.correctPosition)]));
    case "simon-sequence":
      return question.sequence;
    case "mini-sudoku":
      return Object.fromEntries(
        question.grid.flatMap((value, index) => (value === null ? [[String(index), question.solution[index]]] : [])),
      );
    case "mini-nonogram":
      return Object.fromEntries(
        question.solution.flatMap((filled, index) => (filled ? [[String(index), true]] : [])),
      ) as AnswerValue;
    case "queens":
      return { queens: question.solution, marks: [] };
    case "zip":
      return { path: question.solution };
    case "pipes":
      return { rotations: question.solutionRotations, moves: 0 };
    case "sliding-puzzle":
      return { tiles: question.solution, moves: 0 };
    case "escape":
      return { moves: question.referenceSolution };
    case "error-reconstruction":
      return {
        stepId: question.firstErrorStepId,
        correction: question.correction?.correctAnswer ?? null,
      };
    case "word-search":
      return { foundWordIds: question.targets.map((target) => target.id) };
    case "heat-map":
      return question.target;
    default:
      return null;
  }
}

function questionsFor(challenge: Challenge): Question[] {
  switch (challenge.mode) {
    case "alphabet":
      return challenge.entries.map((entry) => entry.question);
    case "narrative":
      return challenge.beats.flatMap((beat) =>
        beat.steps.flatMap((step) => (step.type === "question" ? [step.question] : [])),
      );
    case "pyramid":
      return challenge.levels.map((level) => level.question);
    default:
      return challenge.questions;
  }
}

export function buildMockRoomChallengeAttempt(
  challengeId: string,
  result: RoomChallengeResult,
  playedAt = "2026-09-08T17:39:00.000Z",
): RoomChallengeAttempt | undefined {
  if (!result.completed || result.attempt) return result.attempt;

  const challenge = getChallengeById(challengeId);
  if (!challenge) return undefined;

  let remainingPoints = result.points;
  const answers = questionsFor(challenge).map((question) => {
    const answer = answerFor(question);
    const evaluated = evaluateAnswer({ question, answer, timeUsed: Math.min(3, question.timeLimit) });
    const points = Math.min(Math.max(0, evaluated.points), remainingPoints);
    remainingPoints -= points;
    return {
      questionId: evaluated.questionId,
      answer: evaluated.answer,
      status: evaluated.status,
      isCorrect: evaluated.isCorrect,
      points,
      timeUsed: evaluated.timeUsed,
      details: evaluated.details,
    };
  });

  return {
    challengeId,
    playedAt,
    points: result.points,
    completed: result.completed,
    answers,
  };
}
