import "server-only";

import { cache } from "react";
import { supabaseRoomQueries } from "@/infrastructure/supabase/rooms/queries/roomQueries";
import { getCurrentViewerProfile } from "@/server/profile";

export const getHomePageModel = cache(async () => {
  const viewer = await getCurrentViewerProfile();
  if (!viewer) return null;

  return {
    rooms: await supabaseRoomQueries.listCards(),
    currentViewer: viewer,
  };
});
