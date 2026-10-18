import "server-only";

import { ApplicationDemoChallengeReads } from "@/application/use-cases/challenge-reads";
import {
  mockCurrentViewerProvider,
  mockDemoChallengeQueries,
} from "@/infrastructure/mock/composition";
import { createMockFlashPopPyramidDemoDefinition } from "@/infrastructure/mock/localPyramidDefinition";
import { FLASH_POP_CHALLENGE_ID } from "@/features/flash-pop/demoSocial";

export function createDemoReadServices() {
  return {
    challenges: new ApplicationDemoChallengeReads({
      currentViewer: mockCurrentViewerProvider,
      queries: mockDemoChallengeQueries,
    }),
    localPyramid: {
      getDefinition(challengeId: string) {
        if (challengeId !== FLASH_POP_CHALLENGE_ID) return null;
        return createMockFlashPopPyramidDemoDefinition();
      },
    },
  };
}

export const demoReadServices = createDemoReadServices();
