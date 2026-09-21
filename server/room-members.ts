import "server-only";

import type { ManageRoomMemberInput, ManageRoomMemberResult } from "@/application/ports/room-membership-commands";
import {
  isMockRoomRoute,
  isMockRoomRouteEnabled,
  mockRoomMembershipCommands,
} from "@/infrastructure/mock/composition";
import { supabaseRoomMembershipCommands } from "@/infrastructure/supabase/roomMembershipCommands";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mockMemberPattern = /^[a-z][a-z0-9-]*$/;

export function isValidRoomMemberTarget(roomKey: string, targetMemberKey: string) {
  return uuidPattern.test(targetMemberKey) || (isMockRoomRoute(roomKey) && mockMemberPattern.test(targetMemberKey));
}

/** Selects the explicit demo or persisted command adapter behind the server boundary. */
export async function manageRoomMemberCommand(
  input: ManageRoomMemberInput,
): Promise<ManageRoomMemberResult> {
  const commands = isMockRoomRouteEnabled(input.roomKey)
    ? mockRoomMembershipCommands
    : supabaseRoomMembershipCommands;
  return commands.manageMember(input);
}
