import type { SuperadminSeasonCommandResult } from "@/types/view-models";

export type CreateSeasonInput = {
  readonly idempotencyKey: string;
  readonly roomId: string;
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string;
};

export type UpdateSeasonInput = {
  readonly idempotencyKey: string;
  readonly seasonId: string;
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string;
};

export type ActivateSeasonInput = {
  readonly idempotencyKey: string;
  readonly seasonId: string;
  readonly reason: string;
};

export interface SuperadminSeasonCommands {
  createSeason(input: CreateSeasonInput): Promise<SuperadminSeasonCommandResult>;
  updateSeason(input: UpdateSeasonInput): Promise<SuperadminSeasonCommandResult>;
  activateSeason(input: ActivateSeasonInput): Promise<SuperadminSeasonCommandResult>;
}
