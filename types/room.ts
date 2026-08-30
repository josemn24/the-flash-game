import type { ScheduledChallenge } from "@/types/challenge";

export type SeasonStatus = "active" | "finished";

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
  activeSeason: Season;
};
