import type {
  FlashEditorialQuestionDocument,
  SuperadminQuestionLibraryContext,
  SuperadminQuestionVersionDetail,
  FlashEditorialDocument,
  SuperadminEditorialCommandResult,
  SuperadminEditorialContext,
} from "@/types/view-models/editorial";

export type QuestionLibraryFilters = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly search?: string;
  readonly type?: string;
  readonly status?: "draft" | "published" | "archived" | "all";
  readonly tag?: string;
};

export type CreateQuestionDraftInput = {
  readonly idempotencyKey: string;
  readonly questionDefinitionId?: string;
  readonly document: FlashEditorialQuestionDocument;
  readonly reason: string;
};

export type UpdateQuestionDraftInput = {
  readonly idempotencyKey: string;
  readonly questionVersionId: string;
  readonly expectedUpdatedAt: string;
  readonly document: FlashEditorialQuestionDocument;
  readonly reason: string;
};

export type PublishQuestionInput = {
  readonly idempotencyKey: string;
  readonly questionVersionId: string;
  readonly expectedUpdatedAt: string;
  readonly reason: string;
};

export type ArchiveQuestionInput = {
  readonly idempotencyKey: string;
  readonly questionVersionId: string;
  readonly expectedUpdatedAt: string;
  readonly reason: string;
};

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
  createQuestionDraft(input: CreateQuestionDraftInput): Promise<SuperadminQuestionVersionDetail>;
  updateQuestionDraft(input: UpdateQuestionDraftInput): Promise<SuperadminQuestionVersionDetail>;
  publishQuestion(input: PublishQuestionInput): Promise<SuperadminQuestionVersionDetail>;
  archiveQuestion(input: ArchiveQuestionInput): Promise<SuperadminQuestionVersionDetail>;
}

export interface SuperadminEditorialQueries {
  getContext(): Promise<SuperadminEditorialContext>;
  getQuestionLibrary(filters?: QuestionLibraryFilters): Promise<SuperadminQuestionLibraryContext>;
  getQuestionVersion(questionVersionId: string): Promise<SuperadminQuestionVersionDetail>;
}
