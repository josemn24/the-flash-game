import "server-only";

import { ApplicationDemoChallengeReads } from "@/application/use-cases/challenge-reads";
import {
  mockCurrentViewerProvider,
  mockDemoChallengeQueries,
} from "@/infrastructure/mock/composition";
import {
  createMockFlashPopFlashDemoDefinition,
  createMockFlashPopAlphabetDemoDefinition,
  createMockFlashPopPyramidDemoDefinition,
  createMockFlashPopSurvivalDemoDefinition,
} from "@/infrastructure/mock/localPyramidDefinition";
import {
  createMockFlashPopTimeTrialConnectPairsDemoDefinition,
  createMockFlashPopTimeTrialQueensDemoDefinition,
} from "@/infrastructure/mock/localTimeTrialDefinition";
import {
  FLASH_POP_CHALLENGE_ID,
  FLASH_POP_FLASH_PILOT_ID,
  FLASH_POP_ALPHABET_PILOT_ID,
  FLASH_POP_SURVIVAL_PILOT_ID,
  FLASH_POP_TIME_TRIAL_CONNECT_PAIRS_ID,
  FLASH_POP_TIME_TRIAL_QUEENS_ID,
} from "@/features/flash-pop/demoSocial";

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
    localFlash: {
      getDefinition(challengeId: string) {
        if (challengeId !== FLASH_POP_FLASH_PILOT_ID) return null;
        return createMockFlashPopFlashDemoDefinition();
      },
    },
    localAlphabet: {
      getDefinition(challengeId: string) {
        if (challengeId !== FLASH_POP_ALPHABET_PILOT_ID) return null;
        return createMockFlashPopAlphabetDemoDefinition();
      },
    },
    localSurvival: {
      getDefinition(challengeId: string) {
        if (challengeId !== FLASH_POP_SURVIVAL_PILOT_ID) return null;
        return createMockFlashPopSurvivalDemoDefinition();
      },
    },
    localTimeTrial: {
      getDefinition(challengeId: string) {
        if (challengeId === FLASH_POP_TIME_TRIAL_QUEENS_ID)
          return createMockFlashPopTimeTrialQueensDemoDefinition();
        if (challengeId === FLASH_POP_TIME_TRIAL_CONNECT_PAIRS_ID)
          return createMockFlashPopTimeTrialConnectPairsDemoDefinition();
        return null;
      },
    },
  };
}

export const demoReadServices = createDemoReadServices();
