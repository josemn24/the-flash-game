import "server-only";

import type {
  AddSuperadminRoomMemberInput,
  CreateSuperadminPlayerInput,
} from "@/application/ports/superadmin-user-commands";
import { SuperadminUserCommandError } from "@/application/administration/errors";
import { supabaseSuperadminUserCommands } from "@/infrastructure/supabase/superadminUserCommands";
import {
  SuperadminAuthAdminError,
  createOrRecoverSuperadminAuthUser,
} from "@/infrastructure/supabase/superadminAuthAdmin";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";

export async function lookupSuperadminPlayers(emails: readonly string[]) {
  return supabaseSuperadminUserCommands.lookupPlayers(emails);
}

export async function createSuperadminPlayerAccount(input: {
  readonly idempotencyKey: string;
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly reason: string;
  readonly actorPlayerId: string;
}) {
  consumeAdminRateLimit(`superadmin-user-create:${input.actorPlayerId}`);
  let authUserId: string;
  try {
    authUserId = await createOrRecoverSuperadminAuthUser(input);
  } catch (error) {
    if (error instanceof SuperadminAuthAdminError) {
      throw new SuperadminUserCommandError(error.code, error);
    }
    throw new SuperadminUserCommandError("auth_unavailable", error);
  }

  return supabaseSuperadminUserCommands.createPlayer({
    idempotencyKey: input.idempotencyKey,
    authUserId,
    displayName: input.displayName,
    reason: input.reason,
  } satisfies CreateSuperadminPlayerInput);
}

export async function addSuperadminRoomMember(input: AddSuperadminRoomMemberInput) {
  consumeAdminRateLimit("superadmin-room-member-add");
  return supabaseSuperadminUserCommands.addRoomMember(input);
}
