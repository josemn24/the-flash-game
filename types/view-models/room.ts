import type { Challenge, ChallengeAvailabilityStatus, GameMode } from "@/types/gameplay/challenge";
import type { RoomChallengeResult } from "@/types/gameplay/completion";
import type { LegacySeasonStatus } from "@/types/legacy/room";
import type { RoomCalendarEntry } from "@/types/view-models/calendar";

export type CompetitiveAttemptStatus = "available" | "inProgress" | "completed" | "notCompleted";

export type RoomMembershipRole = "owner" | "admin" | "member" | "spectator";
export type RoomDataSource = "mock" | "supabase";
export type GameplayPersistence = "mock" | "server";

export type GameRoomContext = {
  roomId: string;
  roomTitle: string;
  returnTo: string;
  memberId: string;
  availabilityStatus: ChallengeAvailabilityStatus;
  attemptStatus: CompetitiveAttemptStatus;
  gameplayPersistence?: GameplayPersistence;
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
  seasonStatus: LegacySeasonStatus | null;
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
  }>;
  memberCount: number;
  href: string;
  source?: RoomDataSource;
};

export type RoomDetailModel = {
  roomId: string;
  title: string;
  seasonTitle: string | null;
  seasonStatus: LegacySeasonStatus | null;
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
  source: "supabase";
};

export type RoomMemberDetailModel = {
  roomId: string;
  roomTitle: string;
  member: RoomMemberViewModel;
  challengeSummary: {
    id: string;
    title: string;
    formatLabel: string;
    subtitle: string;
    imageSrc: string;
    questionCount: number;
    playedAt: string;
  } | null;
  challenge: Challenge | null;
  result: RoomChallengeResult | null;
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
  memberCount: number;
  members: Array<{
    id: string;
    name: string;
    initials: string;
    avatarSrc?: string;
    totalFlashPoints: number;
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
  ranking?: RoomHistoryResult[];
};

export type RoomHistoryResult = {
  memberId: string;
  flashPoints: number;
  durationMs: number;
  startedAt: string;
};
