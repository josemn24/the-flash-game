import "server-only";

import { randomUUID } from "node:crypto";
import { AuthenticationRequiredError } from "@/application/administration/errors";
import { getCurrentViewerProfile } from "@/server/profile";
import { SuperadminAccessDeniedError } from "@/application/administration/errors";
import { supabaseSuperadminPortalQueries } from "@/infrastructure/supabase/superadminQueries";
import type { SuperadminPortalContext } from "@/types/view-models";

export type SuperadminActor = {
  readonly playerId: string;
  readonly displayName: string;
  readonly requestId: string;
};

export type AdminAuditContext = {
  readonly actorPlayerId: string;
  readonly operation: string;
  readonly roomId?: string;
  readonly reason?: string;
  readonly requestId: string;
};

export type SuperadminAccess = {
  readonly actor: SuperadminActor;
  readonly context: SuperadminPortalContext;
};

/**
 * Resolves Auth and the persisted platform assignment for every portal request.
 * Future administrative commands must call this guard independently; the page
 * layout and hidden controls are not authorization boundaries.
 */
export async function requireSuperadmin(): Promise<SuperadminAccess> {
  const viewer = await getCurrentViewerProfile();
  if (!viewer) throw new AuthenticationRequiredError();

  const context = await supabaseSuperadminPortalQueries.getContext();
  if (context.operator.playerId !== viewer.playerId) throw new SuperadminAccessDeniedError();

  const requestId = randomUUID();
  return {
    actor: {
      playerId: context.operator.playerId,
      displayName: context.operator.displayName,
      requestId,
    },
    context,
  };
}
