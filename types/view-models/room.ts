import type {
  Challenge,
  ChallengeAvailabilityStatus,
} from "@/types/gameplay/challenge";
import type { RoomChallengeResult } from "@/types/gameplay/completion";
import type { LegacySeasonStatus } from "@/types/legacy/room";

export type CompetitiveAttemptStatus = "available" | "inProgress" | "completed" | "notCompleted";

export type GameRoomContext = {
  roomId: string;
  roomTitle: string;
  returnTo: string;
  memberId: string;
  availabilityStatus: ChallengeAvailabilityStatus;
  attemptStatus: CompetitiveAttemptStatus;
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
};

export type RoomCardModel = {
  roomId: string;
  title: string;
  seasonTitle: string;
  seasonStatus: LegacySeasonStatus;
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
  seasonStatus: LegacySeasonStatus;
  currentUser: {
    id: string;
    name: string;
    initials: string;
    avatarSrc?: string;
    totalFlashPoints: number;
    roomRank: number;
    dailyFlashPoints: number;
    dailyCompleted: boolean;
    dailyAttemptStatus: CompetitiveAttemptStatus;
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
  member: RoomMemberViewModel;
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
};
