import type {
  SuperadminCalendarCommandResult,
  SuperadminCalendarContext,
} from "@/types/view-models";

export type CreateScheduledChallengeInput = {
  readonly idempotencyKey: string;
  readonly seasonId: string;
  readonly challengeVersionId: string;
  readonly number: number;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly reason: string;
};

export type UpdateScheduledChallengeInput = {
  readonly idempotencyKey: string;
  readonly scheduledChallengeId: string;
  readonly expectedUpdatedAt: string;
  readonly challengeVersionId: string;
  readonly number: number;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly reason: string;
};

export type RunCalendarTickResult = {
  readonly runId: string;
  readonly evaluatedAt: string;
  readonly opened: number;
  readonly closed: number;
  readonly finishedSeasons: number;
  readonly source: "supabase";
};

export interface SuperadminCalendarCommands {
  createScheduledChallenge(
    input: CreateScheduledChallengeInput,
  ): Promise<SuperadminCalendarCommandResult>;
  updateScheduledChallenge(
    input: UpdateScheduledChallengeInput,
  ): Promise<SuperadminCalendarCommandResult>;
}

export interface SuperadminCalendarQueries {
  getContext(roomId?: string): Promise<SuperadminCalendarContext>;
}

export interface CalendarTickRunner {
  runCalendarTick(): Promise<RunCalendarTickResult>;
}
