import "server-only";

import type {
  ArchiveQuestionInput,
  CreateFlashDraftInput,
  CreateQuestionDraftInput,
  PublishFlashInput,
  PublishQuestionInput,
  SuperadminEditorialCommands,
  UpdateFlashDraftInput,
  UpdateQuestionDraftInput,
} from "@/application/ports/superadmin-editorial-commands";
import { supabaseSuperadminEditorialCommands } from "@/infrastructure/supabase/superadminEditorialQueries";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";

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

export function publishSuperadminFlash(
  input: PublishFlashInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.publishFlash(input);
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
