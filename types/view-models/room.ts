import type { Challenge, ChallengeAvailabilityStatus, GameMode } from "@/types/gameplay/challenge";
import type { AnswerReview, RoomChallengeResult } from "@/types/gameplay/completion";
import type { PracticeQuestion } from "@/types/gameplay/practice";
import type { SeasonStatus } from "@/types/domain/season";
import type { RoomCalendarEntry } from "@/types/view-models/calendar";

export type RoomSeasonStatus = Extract<SeasonStatus, "active" | "finished">;

export type CompetitiveAttemptStatus = "available" | "inProgress" | "completed" | "notCompleted";

export type RoomMembershipRole = "owner" | "admin" | "member" | "spectator";
export type RoomDataSource = "mock" | "supabase";
export type GameplayPersistence = "mock" | "server";
export type CompetitiveHistoryMode = GameMode;

export type RoomMemberReviewItemStatus =
  "correct" | "partial" | "incorrect" | "unanswered" | "locked";

export type RoomMemberReviewItem = {
  id: string;
  title: string;
  subtitle: string;
  question: PracticeQuestion | null;
  result: AnswerReview | null;
  status: RoomMemberReviewItemStatus;
  metadata?: {
    alphabetLetter?: string;
    levelId?: string;
    label?: string;
    briefing?: {
      title: string;
      format: string;
      description: string;
    };
  };
};

export type RoomMemberReviewProgress =
  | {
      mode: "alphabet";
      answeredCount: number;
      correctCount: number;
      totalLetterCount: number;
    }
  | {
      mode: "flash";
      answeredCount: number;
      totalQuestionCount: number;
    }
  | {
      mode: "survival";
      reachedQuestionCount: number;
      totalQuestionCount: number;
      initialLives: number;
      livesRemaining: number;
      outcome: "in_progress" | "eliminated" | "survived";
    }
  | {
      mode: "pyramid";
      reachedLevelCount: number;
      levelsCleared: number;
      totalLevelCount: number;
      outcome: "in_progress" | "failed" | "summit";
    }
  | {
      mode: "narrative";
      answeredCount: number;
      totalQuestionCount: number;
    };

export type GameRoomContext = {
  roomId: string;
  roomTitle: string;
  returnTo: string;
  memberId: string;
  availabilityStatus: ChallengeAvailabilityStatus;
  attemptStatus: CompetitiveAttemptStatus;
  /** Competitive room contexts never opt into the local mock runtime. */
  gameplayPersistence?: Extract<GameplayPersistence, "server">;
  result?: RoomChallengeResult;
};

export type RoomMemberViewModel = {
  id: string;
  name: string;
  initials: string;
  avatarSrc?: string;
  totalFlashPoints: number;
  challengeResults: Record<string, RoomChallengeResult>;
};

export type RoomLeaderboardEntry = {
  rank: number;
  memberId: string;
  name: string;
  initials: string;
  avatarSrc?: string;
  flashPoints: number;
};

export type RoomDailyLeaderboardEntry = RoomLeaderboardEntry & {
  completed: boolean;
  durationMs: number;
  startedAt: string;
};

export type RoomCardModel = {
  roomId: string;
  title: string;
  seasonTitle: string | null;
  seasonStatus: RoomSeasonStatus | null;
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
    totalFlashPoints: number;
    roomRank: number | null;
    role?: RoomMembershipRole;
  };
  memberPreviews: Array<{
    id: string;
    name: string;
    initials: string;
    src?: string;
    role?: RoomMembershipRole;
  }>;
  memberCount: number;
  href: string;
  source?: RoomDataSource;
};

export type RoomDetailModel = {
  roomId: string;
  title: string;
  seasonTitle: string | null;
  seasonStatus: RoomSeasonStatus | null;
  currentUser: {
    id: string;
    name: string;
    initials: string;
    avatarSrc?: string;
    totalFlashPoints: number;
    roomRank: number | null;
    dailyFlashPoints: number;
    dailyCompleted: boolean;
    dailyAttemptStatus: CompetitiveAttemptStatus;
    role?: RoomMembershipRole;
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
  calendar: readonly RoomCalendarEntry[];
  source?: RoomDataSource;
};

/** Safe projection used by the room challenge introduction fallback. */
export type RoomIntroductionModel = {
  roomId: string;
  roomTitle: string;
  role: RoomMembershipRole;
  publicationId: string;
  publicationStatus: "scheduled" | "open" | "closed" | "cancelled";
  opensAt: string;
  closesAt: string;
  challengeTitle: string;
  challengeSubtitle: string | null;
  mode: GameMode;
  maxScore: number;
  questionCount: number;
  canStart: boolean;
  competitivePlayable: boolean;
  availabilityStatus: "upcoming" | "available" | "closed" | "cancelled";
  source: "mock" | "supabase";
};

export type RoomMemberDetailModel = {
  roomId: string;
  roomTitle: string;
  member: RoomMemberViewModel;
  challengeSummary: {
    id: string;
    mode: GameMode;
    title: string;
    formatLabel: string;
    subtitle: string;
    imageSrc: string;
    questionCount: number;
    playedAt: string;
  } | null;
  challenge: Challenge | null;
  result: RoomChallengeResult | null;
  reviewItems: RoomMemberReviewItem[];
  reviewProgress: RoomMemberReviewProgress | null;
  roomRank: number;
  challengeRank: number | null;
  roomLeaderboard: RoomLeaderboardEntry[];
  challengeLeaderboard: RoomDailyLeaderboardEntry[];
  returnHref: string;
  source?: RoomDataSource;
  canReviewMembers?: boolean;
};

export type RoomSettingsModel = {
  roomId: string;
  title: string;
  currentUserId: string;
  viewerRole: RoomMembershipRole;
  canManageMembers: boolean;
  memberCount: number;
  members: Array<{
    id: string;
    name: string;
    initials: string;
    avatarSrc?: string;
    totalFlashPoints: number;
    role: RoomMembershipRole;
    canManage: boolean;
    isCurrentUser: boolean;
  }>;
};

export type RoomHistoryEntry = {
  id: string;
  challengeId: string;
  mode: CompetitiveHistoryMode;
  title: string;
  formatLabel: string;
  subtitle: string;
  questionCount: number;
  maxScore: number;
  playedAt: string;
  imageSrc: string;
  playerCount: number;
  ranking?: RoomHistoryResult[];
};

export type RoomHistoryResult = {
  memberId: string;
  flashPoints: number;
  durationMs: number;
  startedAt: string;
};
