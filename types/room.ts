import type { ScheduledChallenge } from "@/types/challenge";

export type SeasonStatus = "active" | "finished";

export type RoomChallengeResult = {
  points: number;
  completed: boolean;
};

export type RoomMember = {
  id: string;
  name: string;
  initials: string;
  totalPoints: number;
  challengeResults: Record<string, RoomChallengeResult>;
};

export type RoomLeaderboardEntry = {
  rank: number;
  memberId: string;
  name: string;
  initials: string;
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
    subtitle: string;
    availableUntil: string;
    questionCount: number;
    imageSrc: string;
  } | null;
  currentUser: {
    totalPoints: number;
    roomRank: number;
  };
  memberPreviews: Array<Pick<RoomMember, "id" | "name" | "initials">>;
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
    totalPoints: number;
    roomRank: number;
    dailyPoints: number;
    dailyCompleted: boolean;
  };
  dailyChallenge: {
    id: string;
    title: string;
    subtitle: string;
    imageSrc: string;
    questionCount: number;
    endsAt: string;
    href: string;
  } | null;
  roomLeaderboard: RoomLeaderboardEntry[];
  dailyLeaderboard: RoomDailyLeaderboardEntry[];
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
