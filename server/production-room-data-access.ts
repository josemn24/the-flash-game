import "server-only";

import { cache } from "react";
import { productionReadServices } from "@/server/composition/production";

export const getRoomDetailPageModel = cache(async (roomKey: string) =>
  productionReadServices.rooms.getDetail(roomKey),
);

export const getRoomIntroductionPageModel = cache(async (roomKey: string, challengeKey: string) =>
  productionReadServices.rooms.getIntroduction(roomKey, challengeKey),
);

export const getRoomSettingsPageModel = cache(async (roomKey: string) =>
  productionReadServices.rooms.getSettings(roomKey),
);

export const getRoomRankingPageModel = cache(async (roomKey: string) =>
  productionReadServices.rooms.getRanking(roomKey),
);

export const getRoomMemberDetailPageModel = cache(
  async (roomKey: string, memberKey: string, publicationKey?: string) =>
    productionReadServices.rooms.getMemberDetail(roomKey, memberKey, publicationKey),
);

export const getRoomHistoryPageModel = cache(async (roomKey: string) =>
  productionReadServices.rooms.listHistory(roomKey),
);

export const getRoomHistoryDetailPageModel = cache(async (roomKey: string, challengeKey: string) =>
  productionReadServices.rooms.getHistoryDetail(roomKey, challengeKey),
);
