import type {
  FlashEditorialDocument,
  SuperadminEditorialCommandResult,
  SuperadminEditorialContext,
} from "@/types/view-models/editorial";

export type CreateFlashDraftInput = {
  readonly idempotencyKey: string;
  readonly document: FlashEditorialDocument;
  readonly reason: string;
};

export type UpdateFlashDraftInput = {
  readonly idempotencyKey: string;
  readonly challengeVersionId: string;
  readonly expectedUpdatedAt: string;
  readonly document: FlashEditorialDocument;
  readonly reason: string;
};

export type PublishFlashInput = {
  readonly idempotencyKey: string;
  readonly challengeVersionId: string;
  readonly expectedUpdatedAt: string;
  readonly reason: string;
};

export interface SuperadminEditorialCommands {
  createFlashDraft(input: CreateFlashDraftInput): Promise<SuperadminEditorialCommandResult>;
  updateFlashDraft(input: UpdateFlashDraftInput): Promise<SuperadminEditorialCommandResult>;
  publishFlash(input: PublishFlashInput): Promise<SuperadminEditorialCommandResult>;
}

export interface SuperadminEditorialQueries {
  getContext(): Promise<SuperadminEditorialContext>;
}
