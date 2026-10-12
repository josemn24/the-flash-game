import "server-only";

import { ApplicationCompetitiveChallengeReads } from "@/application/use-cases/challenge-reads";
import { ApplicationRoomReads } from "@/application/use-cases/room-reads";
import { supabaseAttemptExpiration } from "@/infrastructure/supabase/attempts/attemptExpiration";
import { supabasePrivateQuestionAssetResolver } from "@/infrastructure/supabase/assets/privateQuestionAssetResolver";
import { supabaseCompetitiveChallengeQueries } from "@/infrastructure/supabase/gameplay/competitiveChallengeQueries";
import { supabaseCurrentViewerReader } from "@/infrastructure/supabase/identity/currentViewer";
import { SupabaseRoomHistoryQueries } from "@/infrastructure/supabase/rooms/queries/roomHistoryQueries";
import { SupabaseRoomLobbyQueries } from "@/infrastructure/supabase/rooms/queries/roomLobbyQueries";
import { SupabaseRoomMemberDetailQueries } from "@/infrastructure/supabase/rooms/queries/roomMemberDetailQueries";
import { SupabaseRoomRankingQueries } from "@/infrastructure/supabase/rooms/queries/roomRankingQueries";
import { SupabaseRoomSettingsQueries } from "@/infrastructure/supabase/rooms/queries/roomSettingsQueries";

export function createProductionReadServices() {
  const lobby = new SupabaseRoomLobbyQueries();
  const ranking = new SupabaseRoomRankingQueries();
  const settings = new SupabaseRoomSettingsQueries();
  const history = new SupabaseRoomHistoryQueries(supabaseAttemptExpiration);
  const memberDetail = new SupabaseRoomMemberDetailQueries(
    supabaseAttemptExpiration,
    supabasePrivateQuestionAssetResolver,
  );
  const rooms = new ApplicationRoomReads({
    currentViewer: supabaseCurrentViewerReader,
    lobby,
    ranking,
    settings,
    history,
    memberDetail,
  });
  const competitiveChallenges = new ApplicationCompetitiveChallengeReads({
    currentViewer: supabaseCurrentViewerReader,
    queries: supabaseCompetitiveChallengeQueries,
  });

  return { competitiveChallenges, rooms };
}

export const productionReadServices = createProductionReadServices();
