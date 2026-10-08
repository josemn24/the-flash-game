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
import { findEditorialCapabilityIssue } from "@/lib/editorial/capabilityPreflight";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";
import { requireSuperadmin } from "@/server/admin";
import { productionAdminServices } from "@/server/composition/admin";

export async function getSuperadminQuestionVersion(
  questionVersionId: string,
  queries?: Pick<SuperadminEditorialQueries, "getQuestionVersion">,
) {
  if (queries) {
    await requireSuperadmin();
    return queries.getQuestionVersion(questionVersionId);
  }
  return (await productionAdminServices.reads.getQuestionVersion(questionVersionId)).detail;
}

export function createSuperadminFlashDraft(
  input: CreateFlashDraftInput,
  commands?: SuperadminEditorialCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.createFlashDraft(input);
  }
  return productionAdminServices.commands.createFlashDraft(input);
}

export function updateSuperadminFlashDraft(
  input: UpdateFlashDraftInput,
  commands?: SuperadminEditorialCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.updateFlashDraft(input);
  }
  return productionAdminServices.commands.updateFlashDraft(input);
}

export async function publishSuperadminFlash(
  input: PublishFlashInput,
  commands?: SuperadminEditorialCommands,
  queries?: Pick<SuperadminEditorialQueries, "getContext">,
) {
  if (commands || queries) {
    consumeAdminRateLimit("superadmin");
    const context = queries
      ? await queries.getContext()
      : await productionAdminServices.reads.getEditorialContext();
    const version = context.entries.find(
      (entry) => entry.challengeVersionId === input.challengeVersionId,
    );
    const capabilityIssue = version?.document
      ? findEditorialCapabilityIssue(version.document)
      : null;
    if (capabilityIssue) throw new SuperadminEditorialCommandError(capabilityIssue.code);
    return commands
      ? commands.publishFlash(input)
      : productionAdminServices.commands.publishFlash(input);
  }
  return productionAdminServices.commands.publishFlash(input);
}

export function createSuperadminChallengeRevision(
  input: CreateChallengeRevisionInput,
  commands?: SuperadminEditorialCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.createChallengeRevision(input);
  }
  return productionAdminServices.commands.createChallengeRevision(input);
}

export function archiveSuperadminChallengeVersion(
  input: ArchiveChallengeVersionInput,
  commands?: SuperadminEditorialCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.archiveChallengeVersion(input);
  }
  return productionAdminServices.commands.archiveChallengeVersion(input);
}

export function createSuperadminQuestionDraft(
  input: CreateQuestionDraftInput,
  commands?: SuperadminEditorialCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.createQuestionDraft(input);
  }
  return productionAdminServices.commands.createQuestionDraft(input);
}

export function updateSuperadminQuestionDraft(
  input: UpdateQuestionDraftInput,
  commands?: SuperadminEditorialCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.updateQuestionDraft(input);
  }
  return productionAdminServices.commands.updateQuestionDraft(input);
}

export function publishSuperadminQuestion(
  input: PublishQuestionInput,
  commands?: SuperadminEditorialCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.publishQuestion(input);
  }
  return productionAdminServices.commands.publishQuestion(input);
}

export function archiveSuperadminQuestion(
  input: ArchiveQuestionInput,
  commands?: SuperadminEditorialCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.archiveQuestion(input);
  }
  return productionAdminServices.commands.archiveQuestion(input);
}
