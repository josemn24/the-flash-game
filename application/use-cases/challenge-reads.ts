import type { Clock } from "@/application/ports/clock";
import { systemClock } from "@/application/ports/clock";
import type { CurrentViewerReader } from "@/application/ports/current-viewer";
import type { CompetitiveChallengeQueries, DemoChallengeQueries } from "@/application/queries";
import type {
  FlashPopLobbyPageModel,
  CompetitiveChallengePageModel,
  PlayableChallengePageModel,
  QueryContext,
} from "@/types/view-models";

type ChallengeReadDependencies = {
  readonly currentViewer: CurrentViewerReader;
  readonly clock?: Clock;
};

export type ApplicationDemoChallengeReadsDependencies = ChallengeReadDependencies & {
  readonly queries: DemoChallengeQueries;
};

export type ApplicationCompetitiveChallengeReadsDependencies = ChallengeReadDependencies & {
  readonly queries: CompetitiveChallengeQueries;
};

class ApplicationChallengeContext {
  protected readonly currentViewer: CurrentViewerReader;
  protected readonly clock: Clock;

  constructor(dependencies: ChallengeReadDependencies) {
    this.currentViewer = dependencies.currentViewer;
    this.clock = dependencies.clock ?? systemClock;
  }

  protected async createContext(): Promise<QueryContext | null> {
    const viewer = await this.currentViewer.getCurrentViewer();
    return viewer ? { viewer, now: this.clock.now() } : null;
  }
}

export class ApplicationDemoChallengeReads extends ApplicationChallengeContext {
  private readonly queries: DemoChallengeQueries;

  constructor(dependencies: ApplicationDemoChallengeReadsDependencies) {
    super(dependencies);
    this.queries = dependencies.queries;
  }

  async getLobby(): Promise<FlashPopLobbyPageModel | null> {
    const context = await this.createContext();
    return context ? this.queries.getFlashPopLobby(context) : null;
  }

  async getPreview(challengeKey: string): Promise<PlayableChallengePageModel | null> {
    const context = await this.createContext();
    return context ? this.queries.getPreview(challengeKey, context) : null;
  }
}

export class ApplicationCompetitiveChallengeReads extends ApplicationChallengeContext {
  private readonly queries: CompetitiveChallengeQueries;

  constructor(dependencies: ApplicationCompetitiveChallengeReadsDependencies) {
    super(dependencies);
    this.queries = dependencies.queries;
  }

  async getPlayable(
    roomKey: string,
    challengeKey: string,
  ): Promise<CompetitiveChallengePageModel | null> {
    const context = await this.createContext();
    return context ? this.queries.getPlayable(roomKey, challengeKey, context) : null;
  }
}
