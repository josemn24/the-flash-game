import "server-only";

import type { CreateRoomInput, SuperadminRoomCommands } from "@/application/ports/superadmin-room-commands";
import {
  supabaseSuperadminPortalQueries,
  supabaseSuperadminRoomCommands,
} from "@/infrastructure/supabase/superadminQueries";

export async function lookupSuperadminPlayers(emails: readonly string[]) {
  return supabaseSuperadminPortalQueries.lookupPlayersByEmail(emails);
}

export async function createSuperadminRoom(
  input: CreateRoomInput,
  commands: SuperadminRoomCommands = supabaseSuperadminRoomCommands,
) {
  return commands.createRoom(input);
}
