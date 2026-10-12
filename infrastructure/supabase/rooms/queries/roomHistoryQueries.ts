import "server-only";

import type { RoomHistoryQueries } from "@/application/queries";
import type {
  QueryContext,
  RoomHistoryDetailModel,
  RoomHistoryListModel,
} from "@/types/view-models";
import type { AttemptExpirationQueries } from "@/infrastructure/supabase/attempts/attemptExpiration";
import type { RoomHistoryReadRow } from "./roomReadContracts";
import { isRoomHistoryReadRow } from "./roomReadGuards";
import { callHistoryRead, callRoomRead } from "./roomReadRpc";
import { toHistoricalLeaderboard, toHistoryEntry } from "./roomHistoryMappers";

export class SupabaseRoomHistoryQueries implements RoomHistoryQueries {
  constructor(private readonly attemptExpiration: AttemptExpirationQueries) {}

  async listHistory(roomKey: string, _context: QueryContext): Promise<RoomHistoryListModel | null> {
    void _context;
    const rows = await callHistoryRead(
      "get_room_history",
      { target_room_slug: roomKey },
      isRoomHistoryReadRow,
      this.attemptExpiration,
    );
    const first = rows[0];
    if (!first) {
      // The RPC intentionally returns no rows for an unknown or inaccessible room.
      // Resolve the room separately only to distinguish an accessible empty history.
      const roomRows = await callRoomRead("get_room_detail", { target_room_slug: roomKey });
      const room = roomRows[0];
      if (!room) return null;
      return {
        roomId: room.room_slug,
        roomTitle: room.room_title,
        entries: [],
        rankings: {},
        source: "supabase",
      };
    }

    const byPublication = new Map<string, RoomHistoryReadRow[]>();
    for (const row of rows) {
      const group = byPublication.get(row.publication_id) ?? [];
      group.push(row);
      byPublication.set(row.publication_id, group);
    }
    const entries = [...byPublication.values()].map(([row]) => toHistoryEntry(row));
    const rankings = Object.fromEntries(
      [...byPublication.entries()].map(([publicationId, publicationRows]) => [
        publicationId,
        toHistoricalLeaderboard(publicationRows),
      ]),
    );
    return {
      roomId: first.room_slug,
      roomTitle: first.room_title,
      entries,
      rankings,
      source: "supabase",
    };
  }

  async getHistoryDetail(
    roomKey: string,
    publicationKey: string,
    context: QueryContext,
  ): Promise<RoomHistoryDetailModel | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(publicationKey)) return null;
    const rows = await callHistoryRead(
      "get_room_history",
      { target_room_slug: roomKey, target_publication_id: publicationKey },
      isRoomHistoryReadRow,
      this.attemptExpiration,
    );
    const first = rows[0];
    if (!first) return null;
    return {
      roomId: first.room_slug,
      roomTitle: first.room_title,
      currentUserId: context.viewer.playerId,
      entry: toHistoryEntry(first),
      ranking: toHistoricalLeaderboard(rows),
      canReviewMembers: first.viewer_role !== "spectator",
      source: "supabase",
    };
  }
}
