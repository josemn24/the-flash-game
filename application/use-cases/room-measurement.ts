import type { RoomMeasurementGateway } from "@/application/ports/room-measurement";
import { uuid } from "@/lib/measurement/validation";
import {
  calculateSeasonMeasurement,
  seasonMeasurementCsv,
  SEASON_CSV_DATASETS,
  type SeasonCsvDataset,
} from "@/lib/seasonMeasurement";

export class RoomMeasurementUseCases {
  constructor(
    private readonly gateway: RoomMeasurementGateway,
    private readonly requireAdmin: () => Promise<unknown>,
  ) {}

  async season(roomId: string, seasonId?: string) {
    await this.requireAdmin();
    if (!uuid(roomId) || (seasonId !== undefined && !uuid(seasonId)))
      throw new Error("invalid_room_measurement");
    const sources = await this.gateway.season(roomId, seasonId);
    return sources ? calculateSeasonMeasurement(sources) : null;
  }

  async export(roomId: string, seasonId: string, dataset: SeasonCsvDataset) {
    const report = await this.season(roomId, seasonId);
    if (!report?.sources.season) throw new Error("measurement_unavailable");
    if (!SEASON_CSV_DATASETS.includes(dataset)) throw new Error("invalid_dataset");
    return seasonMeasurementCsv(report, dataset);
  }
}
