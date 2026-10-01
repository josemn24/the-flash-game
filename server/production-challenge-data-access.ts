import "server-only";

import { cache } from "react";
import { productionReadServices } from "@/server/composition/production";

export const getPlayableChallengePageModel = cache(
  async (challengeKey: string, roomKey: string | null = null) => {
    return roomKey
      ? productionReadServices.competitiveChallenges.getPlayable(roomKey, challengeKey)
      : null;
  },
);
