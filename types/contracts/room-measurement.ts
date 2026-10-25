import type { SeasonStatus } from "@/types/domain/season";

export type RoomMeasurementMetricTotals = {
  readonly roomVisits: number;
  readonly challengeOpens: number;
  readonly competitiveStarts: number;
  readonly competitiveCompletions: number;
  /** People with non-invalidated competitive starts in at least two publications in scope. */
  readonly returningPeople: number;
  readonly rankingViews: number;
  readonly reviewViews: number;
  readonly practiceStarts: number;
  readonly practiceCompletions: number;
};

export type RoomMeasurementSeason = {
  readonly seasonId: string;
  readonly title: string;
  readonly status: SeasonStatus;
  readonly startsAt: string;
  readonly endsAt: string;
};

export type SeasonMeasurementSources = {
  roomId: string;
  roomTitle: string;
  seasons: RoomMeasurementSeason[];
  season: RoomMeasurementSeason | null;
  /** Navigation capture starts here; persisted attempts may provide earlier season history. */
  startedAt: string | null;
  generatedAt: string;
  participants: { playerId: string; displayName: string; historyFrom: string }[];
  publications: {
    publicationId: string;
    number: number;
    title: string;
    opensAt: string;
    closesAt: string;
    historyFrom: string;
    status: string;
  }[];
  attempts: {
    id: string;
    playerId: string;
    publicationId: string;
    kind: "competitive" | "test";
    status: string;
    score: number | null;
    startedAt: string;
    completedAt: string | null;
  }[];
  events: {
    playerId: string;
    publicationId: string | null;
    type: string;
    count: number;
  }[];
  ratings: { playerId: string; publicationId: string; value: number }[];
};

export type SeasonMeasurementCell = {
  playerId: string;
  publicationId: string;
  eligible: boolean;
  status: string;
  attemptId: string | null;
  score: number | null;
  rating: number | null;
};

export type SeasonMeasurementReport = {
  sources: SeasonMeasurementSources;
  metrics: RoomMeasurementMetricTotals;
  /** Person/publication pairs whose window has opened and overlaps their inclusion history. */
  opportunities: number;
  activePeople: number;
  participants: (SeasonMeasurementSources["participants"][number] & {
    metrics: RoomMeasurementMetricTotals;
    opportunities: number;
    ratingCount: number;
    enjoyment: number | null;
  })[];
  publications: (SeasonMeasurementSources["publications"][number] & {
    metrics: RoomMeasurementMetricTotals;
    opportunities: number;
    ratingCount: number;
    enjoyment: number | null;
  })[];
  cells: SeasonMeasurementCell[];
};
