import "server-only";

import { cache } from "react";
import { mockChallengeQueries, mockCurrentViewerProvider } from "@/infrastructure/mock/composition";
import type { UtcIsoDateTime } from "@/types/domain";
import type { QueryContext } from "@/types/view-models";

const getQueryContext = cache(async (): Promise<QueryContext> => {
  const viewer = await mockCurrentViewerProvider.getCurrentViewer();
  return {
    viewerId: viewer.playerId,
    now: new Date().toISOString() as UtcIsoDateTime,
  };
});

export const getFlashPopLobbyPageModel = cache(async () =>
  mockChallengeQueries.getFlashPopLobby(await getQueryContext()),
);

export const getFlashPopChallengePageModel = cache(async (challengeKey: string) =>
  mockChallengeQueries.getPlayable(challengeKey, null, await getQueryContext()),
);
