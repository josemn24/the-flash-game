import "server-only";

import type {
  CreateRoomInput,
  SuperadminRoomCommands,
} from "@/application/ports/superadmin-room-commands";
import {
  supabaseSuperadminPortalQueries,
  supabaseSuperadminRoomCommands,
} from "@/infrastructure/supabase/superadminQueries";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";

export async function lookupSuperadminPlayers(emails: readonly string[]) {
  return supabaseSuperadminPortalQueries.lookupPlayersByEmail(emails);
}

export async function createSuperadminRoom(
  input: CreateRoomInput,
  commands: SuperadminRoomCommands = supabaseSuperadminRoomCommands,
) {
  consumeAdminRateLimit("superadmin");
  return commands.createRoom(input);
}
