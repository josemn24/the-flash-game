import "server-only";

import type { RoomRankingQueries } from "@/application/queries";
import type { QueryContext, RoomRankingModel } from "@/types/view-models";
import { isSeasonRankingReadRow } from "./roomReadGuards";
import { callRankingRead, callRoomRead } from "./roomReadRpc";
import { toSeasonLeaderboard } from "./roomViewMappers";

export class SupabaseRoomRankingQueries implements RoomRankingQueries {
  async getRanking(roomKey: string, context: QueryContext): Promise<RoomRankingModel | null> {
    const rows = await callRoomRead("get_room_detail", { target_room_slug: roomKey });
    const row = rows[0];
    if (!row || !row.season_id) return null;

    const rankingRows = await callRankingRead(
      "get_season_ranking",
      { target_season_id: row.season_id },
      isSeasonRankingReadRow,
    );
    return {
      roomId: row.room_slug,
      roomTitle: row.room_title,
      currentUserId: context.viewer.playerId,
      entries: toSeasonLeaderboard(rankingRows),
    };
  }
}
