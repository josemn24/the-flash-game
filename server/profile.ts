import "server-only";

import { revalidatePath } from "next/cache";
import { validateProfileName } from "@/lib/userProfile";
import { createClient } from "@/lib/supabase/server";
import type { PlayerId } from "@/types/domain";
import type { ViewerProfile } from "@/types/view-models";
import type { ProfileSaveResult } from "@/types/view-models/user-actions";
import type { UserProfile } from "@/types/view-models/user";

type ProvisionedPlayerRow = {
  player_id: string;
  display_name: string;
  avatar_path: string | null;
  status: "active" | "anonymized";
};

function isProvisionedPlayerRow(value: unknown): value is ProvisionedPlayerRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.player_id === "string" &&
    typeof row.display_name === "string" &&
    (row.avatar_path === null || typeof row.avatar_path === "string") &&
    (row.status === "active" || row.status === "anonymized")
  );
}

function toUserProfile(row: ProvisionedPlayerRow): UserProfile {
  return {
    id: row.player_id,
    name: row.display_name,
    avatarSrc: row.avatar_path ?? undefined,
  };
}

async function getProvisionedCurrentPlayer() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data, error } = await supabase.rpc("provision_player");
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !isProvisionedPlayerRow(row) || row.status !== "active") {
    throw new Error("The authenticated Player could not be provisioned.");
  }

  return { supabase, row };
}

export async function getCurrentViewerProfile(): Promise<ViewerProfile | null> {
  const current = await getProvisionedCurrentPlayer();
  if (!current) return null;

  return {
    ...toUserProfile(current.row),
    playerId: current.row.player_id as PlayerId,
  };
}

export async function updateCurrentPlayerName(name: string): Promise<ProfileSaveResult> {
  const trimmedName = name.trim();
  const validationError = validateProfileName(trimmedName);
  if (validationError) {
    return { ok: false, code: "invalid_name", message: validationError };
  }

  const current = await getProvisionedCurrentPlayer();
  if (!current) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
    };
  }

  const { error } = await current.supabase
    .from("players")
    .update({ display_name: trimmedName })
    .eq("id", current.row.player_id);

  if (error) {
    return {
      ok: false,
      code: "save_failed",
      message: "No se ha podido guardar el nombre. Inténtalo de nuevo.",
    };
  }

  // PostgREST's representation response requires relation-level SELECT. The
  // schema intentionally grants only column-level profile reads, so refresh
  // through the narrow Auth-backed RPC instead of widening table privileges.
  const { data: refreshedData, error: refreshedError } =
    await current.supabase.rpc("provision_player");
  const refreshedRow = Array.isArray(refreshedData) ? refreshedData[0] : refreshedData;
  if (refreshedError || !isProvisionedPlayerRow(refreshedRow) || refreshedRow.status !== "active") {
    return {
      ok: false,
      code: "save_failed",
      message: "No se ha podido confirmar el nombre. Inténtalo de nuevo.",
    };
  }

  const profile = toUserProfile(refreshedRow);
  revalidatePath("/");
  return { ok: true, profile };
}
