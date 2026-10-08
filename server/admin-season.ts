import "server-only";

import type {
  ActivateSeasonInput,
  CreateSeasonInput,
  SuperadminSeasonCommands,
  UpdateSeasonInput,
} from "@/application/ports/superadmin-season-commands";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";
import { productionAdminServices } from "@/server/composition/admin";

export function createSuperadminSeason(
  input: CreateSeasonInput,
  commands?: SuperadminSeasonCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.createSeason(input);
  }
  return productionAdminServices.commands.createSeason(input);
}

export function updateSuperadminSeason(
  input: UpdateSeasonInput,
  commands?: SuperadminSeasonCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.updateSeason(input);
  }
  return productionAdminServices.commands.updateSeason(input);
}

export function activateSuperadminSeason(
  input: ActivateSeasonInput,
  commands?: SuperadminSeasonCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.activateSeason(input);
  }
  return productionAdminServices.commands.activateSeason(input);
}
