import "server-only";

import { cache } from "react";
import { supabaseRoomQueries } from "@/infrastructure/supabase/rooms/queries/roomQueries";

export const getRoomDetailPageModel = cache(async (roomKey: string) =>
  supabaseRoomQueries.getDetail(roomKey),
);

export const getRoomIntroductionPageModel = cache(async (roomKey: string, challengeKey: string) =>
  supabaseRoomQueries.getIntroduction(roomKey, challengeKey),
);

export const getRoomSettingsPageModel = cache(async (roomKey: string) =>
  supabaseRoomQueries.getSettings(roomKey),
);

export const getRoomRankingPageModel = cache(async (roomKey: string) =>
  supabaseRoomQueries.getRanking(roomKey),
);

export const getRoomMemberDetailPageModel = cache(
  async (roomKey: string, memberKey: string, publicationKey?: string) =>
    supabaseRoomQueries.getMemberDetail(roomKey, memberKey, publicationKey),
);

export const getRoomHistoryPageModel = cache(async (roomKey: string) =>
  supabaseRoomQueries.listHistory(roomKey),
);

export const getRoomHistoryDetailPageModel = cache(async (roomKey: string, challengeKey: string) =>
  supabaseRoomQueries.getHistoryDetail(roomKey, challengeKey),
);
