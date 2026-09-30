import "server-only";

import type { CurrentViewerReader } from "@/application/ports/current-viewer";
import { resolveAvatarPath } from "@/lib/media/publicAvatar";
import { createClient } from "@/lib/supabase/server";
import type { PlayerId } from "@/types/domain";
import type { ViewerProfile } from "@/types/view-models";
import type { UserProfile } from "@/types/view-models/user";

export type ProvisionedPlayerRow = {
  player_id: string;
  display_name: string;
  avatar_path: string | null;
  status: "active" | "anonymized";
};

export function isProvisionedPlayerRow(value: unknown): value is ProvisionedPlayerRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.player_id === "string" &&
    typeof row.display_name === "string" &&
    (row.avatar_path === null || typeof row.avatar_path === "string") &&
    (row.status === "active" || row.status === "anonymized")
  );
}

export function toUserProfile(row: ProvisionedPlayerRow): UserProfile {
  return {
    id: row.player_id,
    name: row.display_name,
    avatarSrc: resolveAvatarPath(row.avatar_path),
  };
}

export async function getProvisionedCurrentPlayer() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data, error } = await supabase.rpc("provision_player");
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !isProvisionedPlayerRow(row) || row.status !== "active") {
    throw new Error("The authenticated Player could not be provisioned.");
  }

  return { supabase, row, authUserId: userData.user.id };
}

export const supabaseCurrentViewerReader: CurrentViewerReader = {
  async getCurrentViewer(): Promise<ViewerProfile | null> {
    const current = await getProvisionedCurrentPlayer();
    if (!current) return null;

    return {
      ...toUserProfile(current.row),
      playerId: current.row.player_id as PlayerId,
    };
  },
};
