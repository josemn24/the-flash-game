import type { RoomId, SeasonId } from "@/types/domain/identifiers";
import type { EntityTimestamps, UtcIsoDateTime } from "@/types/domain/values";

export type SeasonStatus = "draft" | "scheduled" | "active" | "finished" | "cancelled";

export type Season = EntityTimestamps & {
  readonly id: SeasonId;
  readonly roomId: RoomId;
  readonly title: string;
  readonly status: SeasonStatus;
  readonly startsAt: UtcIsoDateTime;
  readonly endsAt: UtcIsoDateTime;
};
