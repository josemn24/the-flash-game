import "server-only";

import type { RoomSettingsQueries } from "@/application/queries";
import type { QueryContext, RoomSettingsModel } from "@/types/view-models";
import { isSeasonRankingReadRow } from "./roomReadGuards";
import { callRankingRead, callRoomRead } from "./roomReadRpc";
import { asMemberPreviews } from "./roomViewMappers";

export class SupabaseRoomSettingsQueries implements RoomSettingsQueries {
  async getSettings(roomKey: string, context: QueryContext): Promise<RoomSettingsModel | null> {
    const rows = await callRoomRead("get_room_detail", { target_room_slug: roomKey });
    const row = rows[0];
    if (!row) return null;

    const seasonRows = row.season_id
      ? await callRankingRead(
          "get_season_ranking",
          { target_season_id: row.season_id },
          isSeasonRankingReadRow,
        )
      : [];
    const flashPointsByPlayer = new Map(
      seasonRows.map(({ player_id, flash_points }) => [player_id, flash_points]),
    );

    return {
      roomId: row.room_slug,
      title: row.room_title,
      currentUserId: context.viewer.playerId,
      viewerRole: row.membership_role,
      canManageMembers: row.membership_role === "owner",
      memberCount: row.member_count,
      members: asMemberPreviews(row.member_previews).map((member) => ({
        id: member.id,
        name: member.name,
        initials: member.initials,
        avatarSrc: member.src,
        totalFlashPoints: flashPointsByPlayer.get(member.id) ?? 0,
        role:
          member.id === context.viewer.playerId ? row.membership_role : (member.role ?? "member"),
        canManage:
          row.membership_role === "owner" &&
          member.id !== context.viewer.playerId &&
          (member.role ?? "member") !== "owner",
        isCurrentUser: member.id === context.viewer.playerId,
      })),
    };
  }
}
