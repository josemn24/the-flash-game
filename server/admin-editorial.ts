import "server-only";

import type {
  CreateFlashDraftInput,
  PublishFlashInput,
  SuperadminEditorialCommands,
  UpdateFlashDraftInput,
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
