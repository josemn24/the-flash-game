import "server-only";

import type { ProfileCommands } from "@/application/ports/profile-commands";
import { resolveAvatarPath } from "@/lib/media/publicAvatar";
import type { ProvisionedCurrentPlayer } from "@/infrastructure/supabase/identity/currentViewer";

export function supabaseProfileCommandsFor(current: ProvisionedCurrentPlayer): ProfileCommands {
  return {
    async updateName(input) {
      const { data, error } = await current.supabase
        .from("players")
        .update({ display_name: input.name })
        .eq("id", current.row.player_id)
        .select("id, display_name, avatar_path, status")
        .maybeSingle();

      if (error || !data || data.status !== "active") {
        throw new Error("profile_update_failed");
      }

      return {
        profile: {
          id: data.id,
          name: data.display_name,
          avatarSrc: resolveAvatarPath(data.avatar_path),
        },
      };
    },
  };
}
