import "server-only";

import type {
  ActivateSeasonInput,
  CreateSeasonInput,
  SuperadminSeasonCommands,
  UpdateSeasonInput,
} from "@/application/ports/superadmin-season-commands";
import { supabaseSuperadminSeasonCommands } from "@/infrastructure/supabase/superadminSeasonQueries";

export function createSuperadminSeason(
  input: CreateSeasonInput,
  commands: SuperadminSeasonCommands = supabaseSuperadminSeasonCommands,
) {
  return commands.createSeason(input);
}

export function updateSuperadminSeason(
  input: UpdateSeasonInput,
  commands: SuperadminSeasonCommands = supabaseSuperadminSeasonCommands,
) {
  return commands.updateSeason(input);
}

export function activateSuperadminSeason(
  input: ActivateSeasonInput,
  commands: SuperadminSeasonCommands = supabaseSuperadminSeasonCommands,
) {
  return commands.activateSeason(input);
}
