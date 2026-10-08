import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { SuperadminQuestionAssets } from "@/application/use-cases/superadmin-question-assets";
import {
  ApplicationSuperadminAccess,
  ApplicationSuperadminCommands,
  ApplicationSuperadminReads,
  createCalendarTickApplication,
} from "@/application/use-cases/superadmin";
import type {
  AuthenticatedUserReader,
  RequestIdGenerator,
  SuperadminAuthAdmin,
} from "@/application/ports/superadmin-access";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";
import { getCurrentViewerProfile } from "@/server/profile";
import { createClient } from "@/infrastructure/supabase/auth/server-client";
import {
  abortQuestionAsset,
  archiveQuestionAsset,
  confirmQuestionAsset,
  prepareQuestionAsset,
  readQuestionAssetUpload,
} from "@/infrastructure/supabase/assets/mediaAssetCommands";
import { supabaseMediaStorage } from "@/infrastructure/supabase/assets/mediaStorage";
import { supabaseSuperadminAttemptQueries } from "@/infrastructure/supabase/admin/superadminAttemptQueries";
import { SupabaseSuperadminAttemptCommands } from "@/infrastructure/supabase/admin/superadminAttemptCommands";
import { supabaseSuperadminCalendarQueries } from "@/infrastructure/supabase/admin/superadminCalendarQueries";
import { supabaseSuperadminDashboardQueries } from "@/infrastructure/supabase/admin/superadminDashboardQueries";
import { supabaseSuperadminEditorialQueries } from "@/infrastructure/supabase/admin/superadminEditorialQueries";
import {
  supabaseSuperadminPortalQueries,
  supabaseSuperadminRoomCommands,
  supabaseSuperadminRoomQueries,
} from "@/infrastructure/supabase/admin/superadminQueries";
import { createOrRecoverSuperadminAuthUser } from "@/infrastructure/supabase/admin/superadminAuthAdmin";
import { supabaseSuperadminSeasonCommands } from "@/infrastructure/supabase/admin/superadminSeasonQueries";
import { supabaseSuperadminUserCommands } from "@/infrastructure/supabase/admin/superadminUserCommands";

const authenticatedUser: AuthenticatedUserReader = {
  async getAuthenticatedUserId() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    return error || !data.user ? null : data.user.id;
  },
};

const requestIds: RequestIdGenerator = { generate: () => randomUUID() };

const authAdmin: SuperadminAuthAdmin = {
  createOrRecoverUser: createOrRecoverSuperadminAuthUser,
};

export function createProductionAdminServices() {
  const access = new ApplicationSuperadminAccess({
    currentViewer: { getCurrentViewer: getCurrentViewerProfile },
    authenticatedUser,
    portalQueries: supabaseSuperadminPortalQueries,
    requestIds,
  });

  const reads = new ApplicationSuperadminReads({
    access,
    portal: supabaseSuperadminPortalQueries,
    dashboard: supabaseSuperadminDashboardQueries,
    rooms: supabaseSuperadminRoomQueries,
    editorial: supabaseSuperadminEditorialQueries,
    calendar: supabaseSuperadminCalendarQueries,
    attempts: supabaseSuperadminAttemptQueries,
  });

  const commands = new ApplicationSuperadminCommands({
    access,
    rateLimiter: { consume: consumeAdminRateLimit },
    rooms: supabaseSuperadminRoomCommands,
    editorial: supabaseSuperadminEditorialQueries,
    editorialQueries: supabaseSuperadminEditorialQueries,
    calendar: supabaseSuperadminCalendarQueries,
    seasons: supabaseSuperadminSeasonCommands,
    users: supabaseSuperadminUserCommands,
    authAdmin,
    attemptCommandsFor: (authUserId) => new SupabaseSuperadminAttemptCommands({ authUserId }),
  });

  const questionAssets = new SuperadminQuestionAssets({
    access,
    commands: {
      prepare: prepareQuestionAsset,
      read: readQuestionAssetUpload,
      confirm: confirmQuestionAsset,
      abort: abortQuestionAsset,
      archive: archiveQuestionAsset,
    },
    storage: supabaseMediaStorage,
    ids: {
      generate(authUserId, idempotencyKey) {
        const hex = createHash("sha256")
          .update(`question-asset:${authUserId}:${idempotencyKey}`)
          .digest("hex")
          .slice(0, 32)
          .split("");
        hex[12] = "5";
        hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
        return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
      },
    },
  });

  return {
    access,
    reads,
    commands,
    questionAssets,
    calendarTick: createCalendarTickApplication(supabaseSuperadminCalendarQueries),
  };
}

export const productionAdminServices = createProductionAdminServices();
