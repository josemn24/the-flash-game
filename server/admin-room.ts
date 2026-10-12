import "server-only";

import type {
  CreateRoomInput,
  SuperadminRoomCommands,
} from "@/application/ports/superadmin-room-commands";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";
import { productionAdminServices } from "@/server/composition/admin";

export async function lookupSuperadminPlayers(emails: readonly string[]) {
  return productionAdminServices.reads.lookupPlayers(emails);
}

export async function createSuperadminRoom(
  input: CreateRoomInput,
  commands?: SuperadminRoomCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.createRoom(input);
  }
  return productionAdminServices.commands.createRoom(input);
}
