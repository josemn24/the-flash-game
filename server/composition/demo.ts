import "server-only";

import { ApplicationDemoChallengeReads } from "@/application/use-cases/challenge-reads";
import {
  mockCurrentViewerProvider,
  mockDemoChallengeQueries,
} from "@/infrastructure/mock/composition";

export function createDemoReadServices() {
  return {
    challenges: new ApplicationDemoChallengeReads({
      currentViewer: mockCurrentViewerProvider,
      queries: mockDemoChallengeQueries,
    }),
  };
}

export const demoReadServices = createDemoReadServices();
