import type { SeasonMeasurementSources } from "@/types/contracts/room-measurement";

export interface RoomMeasurementGateway {
  season(roomId: string, seasonId?: string): Promise<SeasonMeasurementSources | null>;
}
