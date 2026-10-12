import "server-only";

import type { RoomRankingQueries } from "@/application/queries";
import type { QueryContext, RoomRankingModel } from "@/types/view-models";
import { createClient } from "@/infrastructure/supabase/auth/server-client";
import { isSeasonRankingReadRow } from "./roomReadGuards";
import { callRankingRead, callRoomRead } from "./roomReadRpc";
import { toSeasonLeaderboard } from "./roomViewMappers";

export class SupabaseRoomRankingQueries implements RoomRankingQueries {
  async getRanking(roomKey: string, context: QueryContext): Promise<RoomRankingModel | null> {
    const rows = await callRoomRead("get_room_detail", { target_room_slug: roomKey });
    const row = rows[0];
    if (!row) return null;

    let season: RoomRankingModel["season"] = null;
    if (row.season_id && row.season_title) {
      season = {
        id: row.season_id,
        title: row.season_title,
        status:
          row.season_status === "finished" ||
          (row.season_ends_at && Date.parse(row.season_ends_at) <= Date.parse(context.now))
            ? "finished"
            : "active",
      };
    } else {
      // Season metadata is public to room members under RLS, including after closure.
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("seasons")
        .select("id, title")
        .eq("room_id", row.room_id)
        .eq("status", "finished")
        .order("ends_at", { ascending: false })
        .order("starts_at", { ascending: false })
        .order("id")
        .limit(1)
        .abortSignal(AbortSignal.timeout(15_000))
        .maybeSingle();
      if (error) throw new Error(`Supabase ranking season read failed: ${error.message}`);
      if (data) season = { id: data.id, title: data.title, status: "finished" };
    }

    const rankingRows = season
      ? await callRankingRead(
          "get_season_ranking",
          { target_season_id: season.id },
          isSeasonRankingReadRow,
        )
      : [];
    return {
      roomId: row.room_slug,
      roomTitle: row.room_title,
      currentUserId: context.viewer.playerId,
      season,
      entries: toSeasonLeaderboard(rankingRows),
    };
  }
}
