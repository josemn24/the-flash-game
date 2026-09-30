import "server-only";

import type { ProfileCommands } from "@/application/ports/profile-commands";
import type { RawRpcResponse } from "@/lib/supabase/rpcTypes";
import {
  getProvisionedCurrentPlayer,
  isProvisionedPlayerRow,
  toUserProfile,
} from "@/infrastructure/supabase/identity/currentViewer";

export const supabaseProfileCommands: ProfileCommands = {
  async updateName(input) {
    const current = await getProvisionedCurrentPlayer();
    if (!current) throw new Error("unauthorized");

    const { error } = await current.supabase
      .from("players")
      .update({ display_name: input.name })
      .eq("id", current.row.player_id);
    if (error) throw new Error("profile_update_failed");

    const refreshedResponse = await current.supabase.rpc("provision_player");
    const { data, error: refreshedError } = refreshedResponse as RawRpcResponse<
      typeof refreshedResponse
    >;
    const refreshedRow = Array.isArray(data) ? data[0] : data;
    if (
      refreshedError ||
      !isProvisionedPlayerRow(refreshedRow) ||
      refreshedRow.status !== "active"
    ) {
      throw new Error("profile_update_failed");
    }
    return { profile: toUserProfile(refreshedRow) };
  },
};
