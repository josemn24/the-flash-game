import type { AnswerValue } from "@/types/question";
import type { AnswerResultDetails, AnswerStatus } from "@/types/gameplay/result";

export type AnswerReview = {
  questionId: string;
  answer: AnswerValue | null;
  status: AnswerStatus;
  isCorrect: boolean;
  points?: number;
  timeUsed?: number;
  details?: AnswerResultDetails;
};

export type AlphabetAnswerReview = Pick<
  AnswerReview,
  "questionId" | "answer" | "status" | "isCorrect"
>;

export type RoomChallengeAttempt = {
  challengeId: string;
  playedAt: string;
  flashPoints: number;
  completed: boolean;
  answers: AnswerReview[];
};

export type RoomChallengeResult = {
  flashPoints: number;
  completed: boolean;
  attempt?: RoomChallengeAttempt;
};

export type ChallengeCompletion = {
  roomId: string;
  challengeId: string;
  flashPoints: number;
  completed: boolean;
  playedAt: string;
  answers: AnswerReview[];
};

export type ChallengeCompletionInput = Omit<ChallengeCompletion, "roomId" | "playedAt">;
export type ChallengeCompletionResult = Omit<ChallengeCompletion, "roomId">;
