import "server-only";

import type {
  CreateFlashDraftInput,
  PublishFlashInput,
  SuperadminEditorialCommands,
  UpdateFlashDraftInput,
} from "@/application/ports/superadmin-editorial-commands";
import {
  supabaseSuperadminEditorialCommands,
} from "@/infrastructure/supabase/superadminEditorialQueries";

export function createSuperadminFlashDraft(
  input: CreateFlashDraftInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
) {
  return commands.createFlashDraft(input);
}

export function updateSuperadminFlashDraft(
  input: UpdateFlashDraftInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
) {
  return commands.updateFlashDraft(input);
}

export function publishSuperadminFlash(
  input: PublishFlashInput,
  commands: SuperadminEditorialCommands = supabaseSuperadminEditorialCommands,
) {
  return commands.publishFlash(input);
}
