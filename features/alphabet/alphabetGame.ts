import { normalizeAnswer } from "@/lib/normalizeAnswer";
import type { AlphabetChallenge, ShortTextQuestion } from "@/types/game";

export type AlphabetLetterStatus =
  "unvisited" | "active" | "passed" | "correct" | "incorrect" | "unanswered";

export type AlphabetLetterState = {
  letter: string;
  questionId: string;
  status: AlphabetLetterStatus;
  answer: string | null;
};

export type AlphabetPhase = "intro" | "countdown" | "playing" | "feedback" | "results" | "review";

export type AlphabetState = {
  phase: AlphabetPhase;
  round: number;
  currentIndex: number;
  letters: AlphabetLetterState[];
  feedback: "correct" | "incorrect" | null;
  elapsedTime: number;
  lastCorrectAt: number | null;
};

export type AlphabetAction =
  | { type: "begin-countdown" }
  | { type: "start" }
  | { type: "pass" }
  | {
      type: "submit";
      answer: string;
      correct: boolean;
      elapsedTime: number;
    }
  | { type: "advance" }
  | { type: "finish"; elapsedTime: number }
  | { type: "show-review" }
  | { type: "show-results" }
  | { type: "replay" };

export function createAlphabetInitialState(challenge: AlphabetChallenge): AlphabetState {
  return {
    phase: "intro",
    round: 1,
    currentIndex: 0,
    letters: challenge.entries.map((entry) => ({
      letter: entry.letter,
      questionId: entry.question.id,
      status: "unvisited",
      answer: null,
    })),
    feedback: null,
    elapsedTime: 0,
    lastCorrectAt: null,
  };
}

function isPending(status: AlphabetLetterStatus) {
  return status === "unvisited" || status === "passed" || status === "active";
}

function finishLetters(letters: AlphabetLetterState[]) {
  return letters.map((letter) =>
    isPending(letter.status) ? { ...letter, status: "unanswered" as const } : letter,
  );
}

function findNextPending(letters: AlphabetLetterState[], currentIndex: number) {
  for (let offset = 1; offset <= letters.length; offset += 1) {
    const index = (currentIndex + offset) % letters.length;
    if (letters[index]?.status === "unvisited") return index;
  }

  for (let offset = 1; offset <= letters.length; offset += 1) {
    const index = (currentIndex + offset) % letters.length;
    if (letters[index]?.status === "passed") return index;
  }

  return null;
}

function activateNext(state: AlphabetState): AlphabetState {
  const nextIndex = findNextPending(state.letters, state.currentIndex);
  if (nextIndex === null) {
    return { ...state, phase: "results", feedback: null };
  }

  const wrapped = nextIndex <= state.currentIndex;
  return {
    ...state,
    phase: "playing",
    round: state.round + (wrapped ? 1 : 0),
    currentIndex: nextIndex,
    feedback: null,
    letters: state.letters.map((letter, index) =>
      index === nextIndex ? { ...letter, status: "active" } : letter,
    ),
  };
}

export function alphabetReducer(state: AlphabetState, action: AlphabetAction): AlphabetState {
  switch (action.type) {
    case "begin-countdown":
      return { ...state, phase: "countdown" };
    case "start":
      return {
        ...state,
        phase: "playing",
        letters: state.letters.map((letter, index) =>
          index === 0 ? { ...letter, status: "active" } : letter,
        ),
      };
    case "pass": {
      if (state.phase !== "playing") return state;
      const passedState = {
        ...state,
        letters: state.letters.map((letter, index) =>
          index === state.currentIndex ? { ...letter, status: "passed" as const } : letter,
        ),
      };
      return activateNext(passedState);
    }
    case "submit":
      if (state.phase !== "playing") return state;
      return {
        ...state,
        phase: "feedback",
        feedback: action.correct ? "correct" : "incorrect",
        elapsedTime: action.elapsedTime,
        lastCorrectAt: action.correct ? action.elapsedTime : state.lastCorrectAt,
        letters: state.letters.map((letter, index) =>
          index === state.currentIndex
            ? {
                ...letter,
                status: action.correct ? "correct" : "incorrect",
                answer: action.answer,
              }
            : letter,
        ),
      };
    case "advance":
      return state.phase === "feedback" ? activateNext(state) : state;
    case "finish":
      return {
        ...state,
        phase: "results",
        feedback: null,
        elapsedTime: action.elapsedTime,
        letters: finishLetters(state.letters),
      };
    case "show-review":
      return { ...state, phase: "review" };
    case "show-results":
      return { ...state, phase: "results" };
    case "replay":
      return {
        ...state,
        phase: "intro",
        round: 1,
        currentIndex: 0,
        letters: state.letters.map((letter) => ({
          ...letter,
          status: "unvisited",
          answer: null,
        })),
        feedback: null,
        elapsedTime: 0,
        lastCorrectAt: null,
      };
  }
}

function hasOnlyTrailingDuplicate(answer: string, candidate: string) {
  if (candidate.length < 5) return false;
  return (
    answer.length === candidate.length + 1 &&
    answer.startsWith(candidate) &&
    answer.at(-1) === candidate.at(-1)
  );
}

export function isAlphabetAnswerCorrect(question: ShortTextQuestion, answer: string) {
  const normalizedAnswer = normalizeAnswer(answer);
  if (!normalizedAnswer) return false;

  const accepted = question.acceptedAnswers ?? [question.correctAnswer];
  return accepted.some((candidate) => {
    const normalizedCandidate = normalizeAnswer(candidate);
    if (normalizedAnswer === normalizedCandidate) return true;
    return hasOnlyTrailingDuplicate(normalizedAnswer, normalizedCandidate);
  });
}

export function calculateAlphabetScore(correctAnswers: number, totalLetters: number) {
  if (totalLetters <= 0) return 0;
  return Math.round((Math.max(0, correctAnswers) / totalLetters) * 100);
}

export type AlphabetCompetitiveResult = {
  correctAnswers: number;
  lastCorrectAt: number | null;
};

export function compareAlphabetResults(
  left: AlphabetCompetitiveResult,
  right: AlphabetCompetitiveResult,
) {
  if (left.correctAnswers !== right.correctAnswers) {
    return right.correctAnswers - left.correctAnswers;
  }
  if (left.lastCorrectAt === right.lastCorrectAt) return 0;
  if (left.lastCorrectAt === null) return 1;
  if (right.lastCorrectAt === null) return -1;
  return left.lastCorrectAt - right.lastCorrectAt;
}
