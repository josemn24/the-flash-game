import "server-only";

import type {
  ActivateSeasonInput,
  CreateSeasonInput,
  SuperadminSeasonCommands,
  UpdateSeasonInput,
} from "@/application/ports/superadmin-season-commands";
import { supabaseSuperadminSeasonCommands } from "@/infrastructure/supabase/superadminSeasonQueries";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";

export function createSuperadminSeason(
  input: CreateSeasonInput,
  commands: SuperadminSeasonCommands = supabaseSuperadminSeasonCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.createSeason(input);
}

export function updateSuperadminSeason(
  input: UpdateSeasonInput,
  commands: SuperadminSeasonCommands = supabaseSuperadminSeasonCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.updateSeason(input);
}

export function activateSuperadminSeason(
  input: ActivateSeasonInput,
  commands: SuperadminSeasonCommands = supabaseSuperadminSeasonCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.activateSeason(input);
}
