import "server-only";

import type { SuperadminAccess } from "@/application/ports/superadmin-access";
import { productionAdminServices } from "@/server/composition/admin";

export type { SuperadminAccess, SuperadminActor } from "@/application/ports/superadmin-access";

export type AdminAuditContext = {
  readonly actorPlayerId: string;
  readonly operation: string;
  readonly roomId?: string;
  readonly reason?: string;
  readonly requestId: string;
};

/**
 * Server-only compatibility facade for the application access use case.
 * Every caller still resolves access independently of UI visibility or layout guards.
 */
export async function requireSuperadmin(): Promise<SuperadminAccess> {
  return productionAdminServices.access.requireAccess();
}
