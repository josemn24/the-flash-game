import "server-only";

import type { CurrentViewerReader } from "@/application/ports/current-viewer";
import type { RoomRankingQueries } from "@/application/queries";
import type { RoomRankingModel } from "@/types/view-models";
import { supabaseCurrentViewerReader } from "@/infrastructure/supabase/currentViewer";
import { isSeasonRankingReadRow } from "./roomReadGuards";
import { callRankingRead, callRoomRead } from "./roomReadRpc";
import { toSeasonLeaderboard } from "./roomViewMappers";

export class SupabaseRoomRankingQueries implements RoomRankingQueries {
  constructor(private readonly currentViewer: CurrentViewerReader = supabaseCurrentViewerReader) {}

  async getRanking(roomKey: string): Promise<RoomRankingModel | null> {
    const viewer = await this.currentViewer.getCurrentViewer();
    if (!viewer) return null;

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
      currentUserId: viewer.playerId,
      entries: toSeasonLeaderboard(rankingRows),
    };
  }
}
