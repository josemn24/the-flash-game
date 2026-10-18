import "server-only";

import { cache } from "react";
import { demoReadServices } from "@/server/composition/demo";

export const getFlashPopLobbyPageModel = cache(async () => demoReadServices.challenges.getLobby());

export const getFlashPopChallengePageModel = cache(async (challengeKey: string) =>
  demoReadServices.challenges.getPreview(challengeKey),
);

/** Local rehearsal fixture, intentionally independent of publication availability dates. */
export const getLocalPyramidDemoDefinition = cache(async (challengeId: string) =>
  demoReadServices.localPyramid.getDefinition(challengeId),
);

/** Local Flash rehearsal fixture, independent of the scheduled challenge dates. */
export const getLocalFlashDemoDefinition = cache(async (challengeId: string) =>
  demoReadServices.localFlash.getDefinition(challengeId),
);
