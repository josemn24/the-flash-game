import type { ScheduledChallenge } from "@/types/gameplay/challenge";
import type { RoomChallengeResult } from "@/types/gameplay/completion";

export type LegacySeasonStatus = "active" | "finished";

export type LegacyRoomMember = {
  id: string;
  name: string;
  initials: string;
  avatarSrc?: string;
  totalFlashPoints: number;
  challengeResults: Record<string, RoomChallengeResult>;
};

export type LegacySeasonSnapshot = {
  id: string;
  title: string;
  status: LegacySeasonStatus;
  scheduledChallenges: ScheduledChallenge[];
};

export type LegacyRoomSnapshot = {
  id: string;
  title: string;
  description: string;
  currentUserId: string;
  members: LegacyRoomMember[];
  activeSeason: LegacySeasonSnapshot;
};
