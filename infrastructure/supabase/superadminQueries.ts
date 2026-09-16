import "server-only";

import type { SuperadminPortalQueries } from "@/application/queries";
import { SuperadminAccessDeniedError } from "@/application/administration/errors";
import { createClient } from "@/lib/supabase/server";
import type { SuperadminPortalContext, SuperadminPortalRoom } from "@/types/view-models";

// The local fixtures deliberately derive stable UUID-shaped identifiers from
// hashes, so validate the wire shape without imposing RFC version bits.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPortalRoom(value: unknown): value is SuperadminPortalRoom {
  if (!isRecord(value)) return false;
  return (
    typeof value.roomId === "string" &&
    uuidPattern.test(value.roomId) &&
    typeof value.slug === "string" &&
    value.slug.trim().length > 0 &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    value.status === "active"
  );
}

function isPortalContext(value: unknown): value is SuperadminPortalContext {
  if (!isRecord(value) || !isRecord(value.operator) || !Array.isArray(value.rooms)) return false;
  return (
    typeof value.operator.playerId === "string" &&
    uuidPattern.test(value.operator.playerId) &&
    typeof value.operator.displayName === "string" &&
    value.operator.displayName.trim().length > 0 &&
    value.rooms.every(isPortalRoom)
  );
}

export class SupabaseSuperadminPortalQueries implements SuperadminPortalQueries {
  async getContext(): Promise<SuperadminPortalContext> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_superadmin_portal_context");

    if (error) {
      if (error.code === "42501") throw new SuperadminAccessDeniedError();
      throw new Error(`Supabase portal read failed: ${error.message}`);
    }
    if (!isPortalContext(data)) {
      throw new Error("Supabase portal read returned an invalid context payload.");
    }

    return { ...data, source: "supabase" };
  }
}

export const supabaseSuperadminPortalQueries = new SupabaseSuperadminPortalQueries();

export function isSuperadminPortalContext(value: unknown): value is SuperadminPortalContext {
  return isPortalContext(value);
}
