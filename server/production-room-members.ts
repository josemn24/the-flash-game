import "server-only";

import type {
  ManageRoomMemberInput,
  ManageRoomMemberResult,
} from "@/application/ports/room-membership-commands";
import { supabaseRoomMembershipCommands } from "@/infrastructure/supabase/rooms/commands/roomMembershipCommands";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidRoomMemberTarget(_roomKey: string, targetMemberKey: string) {
  return uuidPattern.test(targetMemberKey);
}

export async function manageRoomMemberCommand(
  input: ManageRoomMemberInput,
): Promise<ManageRoomMemberResult> {
  return supabaseRoomMembershipCommands.manageMember(input);
}
