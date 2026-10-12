import "server-only";

import type {
  CalendarTickRunner,
  CancelScheduledChallengeInput,
  CreateScheduledChallengeInput,
  SuperadminCalendarCommands,
  SuperadminCalendarQueries,
  UpdateScheduledChallengeInput,
} from "@/application/ports/superadmin-calendar-commands";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";
import { requireSuperadmin } from "@/server/admin";
import { productionAdminServices } from "@/server/composition/admin";

export function createScheduledChallenge(
  input: CreateScheduledChallengeInput,
  commands?: SuperadminCalendarCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.createScheduledChallenge(input);
  }
  return productionAdminServices.commands.createScheduledChallenge(input);
}

export function updateScheduledChallenge(
  input: UpdateScheduledChallengeInput,
  commands?: SuperadminCalendarCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.updateScheduledChallenge(input);
  }
  return productionAdminServices.commands.updateScheduledChallenge(input);
}

export function cancelScheduledChallenge(
  input: CancelScheduledChallengeInput,
  commands?: SuperadminCalendarCommands,
) {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return commands.cancelScheduledChallenge(input);
  }
  return productionAdminServices.commands.cancelScheduledChallenge(input);
}

export async function getSuperadminCalendarContext(
  roomIdOrQueries?: string | SuperadminCalendarQueries,
  configuredQueries?: SuperadminCalendarQueries,
) {
  if (typeof roomIdOrQueries === "string") {
    if (!configuredQueries)
      return productionAdminServices.reads.getCalendarContext(roomIdOrQueries);
    await requireSuperadmin();
    return configuredQueries.getContext(roomIdOrQueries);
  }
  if (roomIdOrQueries) {
    await requireSuperadmin();
    return roomIdOrQueries.getContext();
  }
  if (!configuredQueries) return productionAdminServices.reads.getCalendarContext();
  await requireSuperadmin();
  return configuredQueries.getContext();
}

export function runCalendarTick(runner?: CalendarTickRunner) {
  return runner ? runner.runCalendarTick() : productionAdminServices.calendarTick.runCalendarTick();
}
