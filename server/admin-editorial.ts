import "server-only";

import type {
  ArchiveQuestionInput,
  ArchiveChallengeVersionInput,
  CreateFlashDraftInput,
  CreateChallengeRevisionInput,
  CreateQuestionDraftInput,
  PublishFlashInput,
  PublishQuestionInput,
  SuperadminEditorialCommands,
  UpdateFlashDraftInput,
  UpdateQuestionDraftInput,
} from "@/application/ports/superadmin-editorial-commands";
import type { SuperadminEditorialQueries } from "@/application/ports/superadmin-editorial-commands";
import { SuperadminEditorialCommandError } from "@/application/administration/errors";
import { findEditorialCapabilityIssue } from "@/features/question-formats/capabilityPreflight";
import {
  supabaseSuperadminEditorialCommands,
  supabaseSuperadminEditorialQueries,
} from "@/infrastructure/supabase/admin/superadminEditorialQueries";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";
import { requireSuperadmin } from "@/server/admin";

export async function getSuperadminQuestionVersion(
  questionVersionId: string,
  queries: Pick<
    SuperadminEditorialQueries,
    "getQuestionVersion"
  > = supabaseSuperadminEditorialQueries,
) {
  await requireSuperadmin();
  return queries.getQuestionVersion(questionVersionId);
}

export function createSuperadminFlashDraft(
  input: CreateFlashDraftInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.createFlashDraft(input);
}

export function updateSuperadminFlashDraft(
  input: UpdateFlashDraftInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.updateFlashDraft(input);
}

export async function publishSuperadminFlash(
  input: PublishFlashInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
  queries: Pick<SuperadminEditorialQueries, "getContext"> = supabaseSuperadminEditorialQueries,
) {
  consumeAdminRateLimit("superadmin");
  const context = await queries.getContext();
  const version = context.entries.find(
    (entry) => entry.challengeVersionId === input.challengeVersionId,
  );
  const capabilityIssue = version?.document ? findEditorialCapabilityIssue(version.document) : null;
  if (capabilityIssue) throw new SuperadminEditorialCommandError(capabilityIssue.code);
  return commands.publishFlash(input);
}

export function createSuperadminChallengeRevision(
  input: CreateChallengeRevisionInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.createChallengeRevision(input);
}

export function archiveSuperadminChallengeVersion(
  input: ArchiveChallengeVersionInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.archiveChallengeVersion(input);
}

export function createSuperadminQuestionDraft(
  input: CreateQuestionDraftInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.createQuestionDraft(input);
}

export function updateSuperadminQuestionDraft(
  input: UpdateQuestionDraftInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.updateQuestionDraft(input);
}

export function publishSuperadminQuestion(
  input: PublishQuestionInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.publishQuestion(input);
}

export function archiveSuperadminQuestion(
  input: ArchiveQuestionInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.archiveQuestion(input);
}
