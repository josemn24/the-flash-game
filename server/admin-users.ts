import "server-only";

import type { AddSuperadminRoomMemberInput } from "@/application/ports/superadmin-user-commands";
import { productionAdminServices } from "@/server/composition/admin";

export async function lookupSuperadminPlayers(emails: readonly string[]) {
  return productionAdminServices.reads.lookupPlayers(emails);
}

export async function createSuperadminPlayerAccount(input: {
  readonly idempotencyKey: string;
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly reason: string;
  readonly actorPlayerId: string;
}) {
  void input.actorPlayerId;
  return productionAdminServices.commands.createPlayer({
    idempotencyKey: input.idempotencyKey,
    email: input.email,
    password: input.password,
    displayName: input.displayName,
    reason: input.reason,
  });
}

export async function addSuperadminRoomMember(input: AddSuperadminRoomMemberInput) {
  return productionAdminServices.commands.addRoomMember(input);
}
