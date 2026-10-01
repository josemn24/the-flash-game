import "server-only";

import { cache } from "react";
import { demoReadServices } from "@/server/composition/demo";

export const getFlashPopLobbyPageModel = cache(async () => demoReadServices.challenges.getLobby());

export const getFlashPopChallengePageModel = cache(async (challengeKey: string) =>
  demoReadServices.challenges.getPreview(challengeKey),
);
