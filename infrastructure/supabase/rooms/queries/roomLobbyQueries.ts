import "server-only";

import type { CurrentViewerReader } from "@/application/ports/current-viewer";
import type { RoomLobbyQueries } from "@/application/queries";
import { supabaseCurrentViewerReader } from "@/infrastructure/supabase/identity/currentViewer";
import type { RoomCalendarReadRow } from "./roomReadContracts";
import {
  isChallengeRankingReadRow,
  isRoomCalendarReadRow,
  isRoomIntroductionReadRow,
  isSeasonRankingReadRow,
} from "./roomReadGuards";
import { callRankingRead, callRoomRead } from "./roomReadRpc";
import {
  toCalendarEntry,
  toCard,
  toChallengeLeaderboard,
  toDetail,
  toIntroduction,
  toSeasonLeaderboard,
} from "./roomViewMappers";

export class SupabaseRoomLobbyQueries implements RoomLobbyQueries {
  constructor(private readonly currentViewer: CurrentViewerReader = supabaseCurrentViewerReader) {}

  async listCards() {
    return (await callRoomRead("get_my_room_cards")).map(toCard);
  }

  async getDetail(roomKey: string) {
    const viewer = await this.currentViewer.getCurrentViewer();
    if (!viewer) return null;
    const rows = await callRoomRead("get_room_detail", { target_room_slug: roomKey });
    const row = rows[0];
    if (!row) return null;

    const [seasonRows, dailyRows, calendarRows] = await Promise.all([
      row.season_id
        ? callRankingRead(
            "get_season_ranking",
            { target_season_id: row.season_id },
            isSeasonRankingReadRow,
          )
        : Promise.resolve([]),
      row.publication_id && row.publication_status === "open"
        ? callRankingRead(
            "get_challenge_ranking",
            { target_publication_id: row.publication_id },
            isChallengeRankingReadRow,
          )
        : Promise.resolve([]),
      callRoomRead("get_room_calendar", { target_room_slug: roomKey }, isRoomCalendarReadRow),
    ]);

    return toDetail(
      row,
      viewer,
      toSeasonLeaderboard(seasonRows),
      toChallengeLeaderboard(dailyRows),
      calendarRows.map((value) => toCalendarEntry(value as RoomCalendarReadRow)),
    );
  }

  async getIntroduction(roomKey: string, challengeKey: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(challengeKey)) return null;
    const rows = await callRoomRead(
      "get_room_introduction",
      {
        target_room_slug: roomKey,
        target_publication_id: challengeKey,
      },
      isRoomIntroductionReadRow,
    );
    return rows[0] ? toIntroduction(rows[0]) : null;
  }
}
