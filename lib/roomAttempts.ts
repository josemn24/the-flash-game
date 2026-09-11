import { getChallengeById } from "@/data/challenges";
import { withChallengeScoring, withPyramidScoring } from "@/lib/challengeScoring";
import { evaluateAnswer } from "@/lib/scoring";
import type {
  AnswerReview,
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

type MockAttemptOptions = {
  playedAt?: string;
  seed?: string;
};

type MockCandidateKind = "correct" | "incorrect" | "timeout";

type MockCandidate = {
  kind: MockCandidateKind;
  answer: AnswerReview;
};

type MockPath = {
  points: number;
  answers: AnswerReview[];
  kinds: Set<MockCandidateKind>;
  correctCount: number;
};

const DEFAULT_PLAYED_AT = "2026-09-08T17:39:00.000Z";

function hashSeed(value: string) {
  return [...value].reduce((hash, character) => ((hash * 31 + character.charCodeAt(0)) >>> 0), 7);
}

function timeFor(seed: string, question: Question, index: number, fraction: number) {
  const variation = (hashSeed(`${seed}:${question.id}:${index}`) % 7) / 10;
  return Math.min(question.timeLimit, Math.max(0, question.timeLimit * fraction + variation));
}

function mutateValue(value: unknown): unknown {
  if (typeof value === "string") return `${value} (respuesta incorrecta)`;
  if (typeof value === "number") return value + 1;
  if (typeof value === "boolean") return !value;
  if (Array.isArray(value)) {
    return value.length > 0
      ? value.map((item, index) => (index === 0 ? mutateValue(item) : item))
      : ["respuesta incorrecta"];
  }
  if (value && typeof value === "object") {
    const [key] = Object.keys(value);
    if (!key) return { incorrect: true };
    return { ...value, [key]: mutateValue((value as Record<string, unknown>)[key]) };
  }
  return "respuesta incorrecta";
}

function incorrectAnswerFor(question: Question, correctAnswer: AnswerValue | null) {
  if (correctAnswer === null) return null;
  return mutateValue(correctAnswer) as AnswerValue;
}

function scoredChallengeForMock(challenge: Challenge) {
  switch (challenge.mode) {
    case "flash":
    case "survival":
      return withChallengeScoring(challenge);
    case "pyramid":
      return withPyramidScoring(challenge);
    default:
      return challenge;
  }
}

function answerForQuestion(question: Question, kind: MockCandidateKind, timeUsed: number): AnswerReview {
  const correctAnswer = answerFor(question);
  if (kind === "timeout") {
    const evaluated = evaluateAnswer({
      question,
      answer: null,
      timeUsed: question.timeLimit,
      timedOut: true,
    });
    return {
      questionId: evaluated.questionId,
      answer: evaluated.answer,
      status: "unanswered",
      isCorrect: false,
      points: 0,
      timeUsed: evaluated.timeUsed,
      details: evaluated.details,
    };
  }

  const answer = kind === "correct" ? correctAnswer : incorrectAnswerFor(question, correctAnswer);
  const evaluated = evaluateAnswer({ question, answer, timeUsed });
  const isCorrect = evaluated.isCorrect;
  return {
    questionId: evaluated.questionId,
    answer: evaluated.answer,
    status: isCorrect ? "correct" : kind === "incorrect" ? "incorrect" : evaluated.status,
    isCorrect,
    points: isCorrect ? Math.max(0, evaluated.points) : 0,
    timeUsed: evaluated.timeUsed,
    details: evaluated.details,
  };
}

function correctCandidates(question: Question, seed: string, index: number) {
  const byPoints = new Map<number, MockCandidate>();
  const steps = Math.min(20, Math.max(1, Math.ceil(question.timeLimit * 2)));
  for (let step = 0; step <= steps; step += 1) {
    const timeUsed = question.timeLimit * (step / steps);
    const answer = answerForQuestion(question, "correct", timeUsed);
    if (answer.isCorrect && (answer.points ?? 0) > 0 && !byPoints.has(answer.points ?? 0)) {
      byPoints.set(answer.points ?? 0, { kind: "correct", answer });
    }
  }

  const candidates = [...byPoints.values()];
  const offset = hashSeed(`${seed}:${question.id}:${index}`) % Math.max(1, candidates.length);
  return candidates.slice(offset).concat(candidates.slice(0, offset));
}

function failureCandidates(question: Question, seed: string, index: number): MockCandidate[] {
  const candidates: MockCandidate[] = [
    {
      kind: "timeout",
      answer: answerForQuestion(question, "timeout", question.timeLimit),
    },
  ];
  const incorrect = answerForQuestion(
    question,
    "incorrect",
    timeFor(seed, question, index, 0.65),
  );
  if (incorrect.status === "incorrect" && !incorrect.isCorrect && incorrect.points === 0) {
    candidates.unshift({ kind: "incorrect", answer: incorrect });
  }
  return candidates;
}

function pathQuality(path: MockPath) {
  const hasIncorrect = path.kinds.has("incorrect") ? 1 : 0;
  const hasTimeout = path.kinds.has("timeout") ? 1 : 0;
  return [hasIncorrect + hasTimeout, path.correctCount, -path.answers.length];
}

function isBetterPath(candidate: MockPath, current?: MockPath) {
  if (!current) return true;
  const candidateQuality = pathQuality(candidate);
  const currentQuality = pathQuality(current);
  for (let index = 0; index < candidateQuality.length; index += 1) {
    if (candidateQuality[index] !== currentQuality[index]) {
      return candidateQuality[index] > currentQuality[index];
    }
  }
  return false;
}

function findExactMockPath(questions: Question[], targetPoints: number, seed: string) {
  const states = new Map<string, MockPath>();
  states.set("0|", { points: 0, answers: [], kinds: new Set(), correctCount: 0 });

  questions.forEach((question, index) => {
    const next = new Map<string, MockPath>();
    const candidates = [
      ...correctCandidates(question, seed, index),
      ...failureCandidates(question, seed, index),
    ];

    for (const path of states.values()) {
      for (const candidate of candidates) {
        const points = path.points + (candidate.answer.points ?? 0);
        if (points > targetPoints) continue;
        const kinds = new Set(path.kinds).add(candidate.kind);
        const nextPath: MockPath = {
          points,
          answers: [...path.answers, candidate.answer],
          kinds,
          correctCount: path.correctCount + (candidate.kind === "correct" ? 1 : 0),
        };
        const key = `${points}|${[...kinds].sort().join(",")}`;
        if (isBetterPath(nextPath, next.get(key))) next.set(key, nextPath);
      }
    }
    states.clear();
    for (const [key, path] of next) states.set(key, path);
  });

  const exactPaths = [...states.values()].filter(
    (path) => path.points === targetPoints && path.correctCount > 0,
  );
  return exactPaths.sort((left, right) => {
    const leftQuality = pathQuality(left);
    const rightQuality = pathQuality(right);
    for (let index = 0; index < leftQuality.length; index += 1) {
      if (leftQuality[index] !== rightQuality[index]) return rightQuality[index] - leftQuality[index];
    }
    return 0;
  })[0];
}

function buildProportionalFallback(questions: Question[], targetPoints: number, seed: string) {
  const answers = questions.map((question, index) =>
    answerForQuestion(question, "timeout", question.timeLimit),
  );
  let remainingPoints = targetPoints;
  const order = questions
    .map((question, index) => ({ index, order: hashSeed(`${seed}:${question.id}:${index}`) }))
    .sort((left, right) => left.order - right.order);

  for (const { index } of order) {
    if (remainingPoints <= 0) break;
    const question = questions[index];
    const points = Math.min(remainingPoints, Math.max(1, question.points));
    answers[index] = {
      ...answerForQuestion(
        question,
        "correct",
        timeFor(seed, question, index, 0.5),
      ),
      points,
    };
    remainingPoints -= points;
  }

  if (remainingPoints > 0 && answers.length > 0) {
    const index = order[0]?.index ?? 0;
    answers[index] = {
      ...answers[index],
      status: "correct",
      isCorrect: true,
      points: (answers[index]?.points ?? 0) + remainingPoints,
    };
  }

  return answers;
}

function buildAlphabetAttempt(
  challenge: Extract<Challenge, { mode: "alphabet" }>,
  result: RoomChallengeResult,
  seed: string,
) {
  const questions = challenge.entries.map((entry) => entry.question);
  const targetPoints = Math.max(0, result.points);
  const failedQuestions = targetPoints < 100 ? Math.max(2, Math.round(questions.length * 0.25)) : 0;
  const correctCount = targetPoints > 0
    ? Math.max(1, Math.min(questions.length - failedQuestions, Math.round((targetPoints / 100) * questions.length)))
    : 0;
  const pointsPerCorrect = correctCount > 0 ? Math.floor(targetPoints / correctCount) : 0;
  const extraPoints = correctCount > 0 ? targetPoints % correctCount : 0;

  const answers = questions.map((question, index) => {
    if (index < correctCount) {
      const answer = answerForQuestion(
        question,
        "correct",
        timeFor(seed, question, index, 0.35),
      );
      return {
        ...answer,
        points: pointsPerCorrect + (index < extraPoints ? 1 : 0),
      };
    }

    const kind: MockCandidateKind = (hashSeed(`${seed}:${question.id}`) + index) % 2 === 0
      ? "incorrect"
      : "timeout";
    return answerForQuestion(question, kind, question.timeLimit);
  });

  return answers;
}

export function buildMockRoomChallengeAttempt(
  challengeId: string,
  result: RoomChallengeResult,
  options: MockAttemptOptions | string = {},
): RoomChallengeAttempt | undefined {
  if (!result.completed || result.attempt) return result.attempt;

  const challenge = getChallengeById(challengeId);
  if (!challenge) return undefined;

  const playedAt = typeof options === "string" ? options : options.playedAt ?? DEFAULT_PLAYED_AT;
  const seed = typeof options === "string" ? challengeId : options.seed ?? challengeId;
  const targetPoints = Math.max(0, result.points);
  const scoredChallenge = scoredChallengeForMock(challenge);
  const questions = questionsFor(scoredChallenge);
  const answers = challenge.mode === "alphabet"
    ? buildAlphabetAttempt(challenge, result, seed)
    : findExactMockPath(questions, targetPoints, seed)?.answers ??
      buildProportionalFallback(questions, targetPoints, seed);

  return {
    challengeId,
    playedAt,
    points: result.points,
    completed: result.completed,
    answers,
  };
}
