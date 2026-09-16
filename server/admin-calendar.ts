import "server-only";

import type {
  CalendarTickRunner,
  CreateScheduledChallengeInput,
  SuperadminCalendarCommands,
  SuperadminCalendarQueries,
  UpdateScheduledChallengeInput,
} from "@/application/ports/superadmin-calendar-commands";
import { supabaseSuperadminCalendarQueries } from "@/infrastructure/supabase/superadminCalendarQueries";

export function createScheduledChallenge(
  input: CreateScheduledChallengeInput,
  commands: SuperadminCalendarCommands = supabaseSuperadminCalendarQueries,
) {
  return commands.createScheduledChallenge(input);
}

export function updateScheduledChallenge(
  input: UpdateScheduledChallengeInput,
  commands: SuperadminCalendarCommands = supabaseSuperadminCalendarQueries,
) {
  return commands.updateScheduledChallenge(input);
}

export function getSuperadminCalendarContext(
  queries: SuperadminCalendarQueries = supabaseSuperadminCalendarQueries,
) {
  return queries.getContext();
}

export function runCalendarTick(
  runner: CalendarTickRunner = supabaseSuperadminCalendarQueries,
) {
  return runner.runCalendarTick();
}
