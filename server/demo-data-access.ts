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

/** Local Survival rehearsal fixture, independent of the scheduled challenge dates. */
export const getLocalSurvivalDemoDefinition = cache(async (challengeId: string) =>
  demoReadServices.localSurvival.getDefinition(challengeId),
);

/** Local Time Trial fixtures for Queens and Connect Pairs, independent of publication dates. */
export const getLocalTimeTrialDemoDefinition = cache(async (challengeId: string) =>
  demoReadServices.localTimeTrial.getDefinition(challengeId),
);
