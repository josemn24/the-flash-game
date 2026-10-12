import "server-only";

import { productionAdminServices } from "@/server/composition/admin";
export type {
  QuestionAssetOperationError,
  QuestionAssetUploadPreparation,
} from "@/application/use-cases/superadmin-question-assets";

export function prepareSuperadminQuestionAsset(input: {
  readonly mimeType: string;
  readonly byteSize: number;
  readonly idempotencyKey: string;
}) {
  return productionAdminServices.questionAssets.prepare(input);
}

export function confirmSuperadminQuestionAsset(input: {
  readonly assetId: string;
  readonly idempotencyKey: string;
}) {
  return productionAdminServices.questionAssets.confirm(input);
}

export function abortSuperadminQuestionAsset(assetId: string) {
  return productionAdminServices.questionAssets.abort(assetId);
}

export function previewSuperadminQuestionAsset(assetId: string) {
  return productionAdminServices.questionAssets.preview(assetId);
}

export function archiveSuperadminQuestionAsset(input: {
  readonly assetId: string;
  readonly idempotencyKey: string;
  readonly reason: string;
}) {
  return productionAdminServices.questionAssets.archive(input);
}
