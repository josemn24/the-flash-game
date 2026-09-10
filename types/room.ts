import type { ScheduledChallenge } from "@/types/challenge";
import type { Challenge } from "@/types/challenge";
import type { AnswerValue } from "@/types/question";
import type { AnswerResultDetails, AnswerStatus } from "@/types/result";

export type SeasonStatus = "active" | "finished";

export type AnswerReview = {
  questionId: string;
  answer: AnswerValue | null;
  status: AnswerStatus;
  isCorrect: boolean;
  points?: number;
  timeUsed?: number;
  details?: AnswerResultDetails;
};

export type AlphabetAnswerReview = Pick<AnswerReview, "questionId" | "answer" | "status" | "isCorrect">;

export type RoomChallengeAttempt = {
  challengeId: string;
  playedAt: string;
  points: number;
  completed: boolean;
  answers: AnswerReview[];
};

export type RoomChallengeResult = {
  points: number;
  completed: boolean;
  attempt?: RoomChallengeAttempt;
};

export type ChallengeCompletion = {
  roomId: string;
  challengeId: string;
  points: number;
  completed: boolean;
  playedAt: string;
  answers: AnswerReview[];
};

export type ChallengeCompletionInput = Omit<ChallengeCompletion, "roomId" | "playedAt">;
export type ChallengeCompletionResult = Omit<ChallengeCompletion, "roomId">;

export type GameRoomContext = {
  roomId: string;
  roomTitle: string;
  returnTo: string;
};

export type RoomMember = {
  id: string;
  name: string;
  initials: string;
  avatarSrc?: string;
  totalPoints: number;
  challengeResults: Record<string, RoomChallengeResult>;
};

export type RoomLeaderboardEntry = {
  rank: number;
  memberId: string;
  name: string;
  initials: string;
  avatarSrc?: string;
  points: number;
};

export type RoomDailyLeaderboardEntry = RoomLeaderboardEntry & {
  completed: boolean;
};

export type RoomCardModel = {
  roomId: string;
  title: string;
  seasonTitle: string;
  seasonStatus: SeasonStatus;
  dailyChallenge: {
    id: string;
    title: string;
    formatLabel: string;
    subtitle: string;
    availableUntil: string;
    questionCount: number;
    imageSrc: string;
  } | null;
  currentUser: {
    totalPoints: number;
    roomRank: number;
  };
  memberPreviews: Array<{
    id: string;
    name: string;
    initials: string;
    src?: string;
  }>;
  memberCount: number;
  href: string;
};

export type RoomDetailModel = {
  roomId: string;
  title: string;
  seasonTitle: string;
  seasonStatus: SeasonStatus;
  currentUser: {
    id: string;
    name: string;
    initials: string;
    avatarSrc?: string;
    totalPoints: number;
    roomRank: number;
    dailyPoints: number;
    dailyCompleted: boolean;
  };
  dailyChallenge: {
    id: string;
    title: string;
    formatLabel: string;
    subtitle: string;
    imageSrc: string;
    questionCount: number;
    endsAt: string;
    href: string;
  } | null;
  roomLeaderboard: RoomLeaderboardEntry[];
  dailyLeaderboard: RoomDailyLeaderboardEntry[];
};

export type RoomMemberDetailModel = {
  roomId: string;
  roomTitle: string;
  member: RoomMember;
  dailyChallenge: RoomDetailModel["dailyChallenge"];
  challenge: Challenge | null;
  result: RoomChallengeResult | null;
  roomRank: number;
  dailyRank: number | null;
  roomLeaderboard: RoomLeaderboardEntry[];
  dailyLeaderboard: RoomDailyLeaderboardEntry[];
};

export type RoomSettingsModel = {
  roomId: string;
  title: string;
  currentUserId: string;
  memberCount: number;
  members: Array<{
    id: string;
    name: string;
    initials: string;
    avatarSrc?: string;
    totalPoints: number;
    isCurrentUser: boolean;
  }>;
};

export type RoomHistoryEntry = {
  id: string;
  challengeId: string;
  title: string;
  playedAt: string;
  imageSrc: string;
  playerCount: number;
  winnerMemberId?: string;
};

export type Season = {
  id: string;
  title: string;
  status: SeasonStatus;
  scheduledChallenges: ScheduledChallenge[];
};

export type Room = {
  id: string;
  title: string;
  description: string;
  currentUserId: string;
  members: RoomMember[];
  activeSeason: Season;
};
