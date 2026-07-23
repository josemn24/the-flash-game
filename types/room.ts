import type { Challenge } from "@/types/challenge";

export type SeasonStatus = "active" | "finished";

export type Season = {
  id: string;
  title: string;
  status: SeasonStatus;
  challenges: Challenge[];
};

export type Room = {
  id: string;
  title: string;
  description: string;
  activeSeason: Season;
};
