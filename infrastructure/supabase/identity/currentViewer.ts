import "server-only";

import type { CurrentViewerReader } from "@/application/ports/current-viewer";
import { resolveAvatarPath } from "@/infrastructure/supabase/assets/publicAvatar";
import { createClient } from "@/infrastructure/supabase/auth/server-client";
import type { PublicFunctionRow, RawRpcResponse } from "@/infrastructure/supabase/rpcTypes";
import type { PlayerId } from "@/types/domain";
import type { ViewerProfile } from "@/types/view-models";
import type { UserProfile } from "@/types/view-models/user";
import { isInvalidSession } from "@/infrastructure/supabase/auth/auth-availability";

type ProvisionedPlayerOverrides = {
  avatar_path: string | null;
  status: "active" | "anonymized";
};

type ProvisionedPlayerRpcRow = PublicFunctionRow<"provision_player">;

export type ProvisionedPlayerRow = Omit<ProvisionedPlayerRpcRow, keyof ProvisionedPlayerOverrides> &
  ProvisionedPlayerOverrides;

export type ProvisionedCurrentPlayer = {
  readonly supabase: Awaited<ReturnType<typeof createClient>>;
  readonly authUserId: string;
  readonly row: ProvisionedPlayerRow;
};

type CurrentPlayerProfileRow = {
  readonly id: string;
  readonly display_name: string;
  readonly avatar_path: string | null;
  readonly status: string;
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

function toViewerProfile(row: CurrentPlayerProfileRow | null): ViewerProfile | null {
  if (!row || row.status !== "active") return null;

  return {
    id: row.id,
    playerId: row.id as PlayerId,
    name: row.display_name,
    avatarSrc: resolveAvatarPath(row.avatar_path),
  };
}

export async function getProvisionedCurrentPlayer(): Promise<ProvisionedCurrentPlayer | null> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError && !isInvalidSession(userError)) throw userError;
  if (!userData.user) return null;

  const response = await supabase.rpc("provision_player");
  const { data, error } = response as RawRpcResponse<typeof response>;
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !isProvisionedPlayerRow(row) || row.status !== "active") {
    throw new Error("The authenticated Player could not be provisioned.");
  }

  return { supabase, row, authUserId: userData.user.id };
}

export function supabaseCurrentViewerReaderFor(
  current: ProvisionedCurrentPlayer,
): CurrentViewerReader {
  return {
    async getCurrentViewer(): Promise<ViewerProfile | null> {
      const { data, error } = await current.supabase
        .from("players")
        .select("id, display_name, avatar_path, status")
        .eq("id", current.row.player_id)
        .maybeSingle();

      if (error) throw new Error("The authenticated Player could not be read.");
      return toViewerProfile(data);
    },
  };
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
