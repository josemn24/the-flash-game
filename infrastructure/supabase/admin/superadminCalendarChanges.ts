import "server-only";
import type { SuperadminCalendarChanges } from "@/application/ports/superadmin-calendar-changes";
import type {
  CalendarChangeInput,
  CalendarChangePreview,
} from "@/types/view-models/calendar-change";
import {
  SuperadminCalendarCommandError,
  SuperadminAccessDeniedError,
} from "@/application/administration/errors";
import { createClient } from "@/infrastructure/supabase/auth/server-client";

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function window(value: unknown, start: string, end: string) {
  return (
    record(value) &&
    typeof value[start] === "string" &&
    typeof value[end] === "string" &&
    Number.isFinite(Date.parse(value[start] as string)) &&
    Number.isFinite(Date.parse(value[end] as string))
  );
}
function isPreview(value: unknown): value is CalendarChangePreview {
  return (
    record(value) &&
    typeof value.evaluatedAt === "string" &&
    Number.isFinite(Date.parse(value.evaluatedAt)) &&
    typeof value.roomId === "string" &&
    typeof value.seasonId === "string" &&
    record(value.season) &&
    window(value.season.before, "startsAt", "endsAt") &&
    window(value.season.after, "startsAt", "endsAt") &&
    Array.isArray(value.publications) &&
    value.publications.every(
      (publication: unknown) =>
        record(publication) &&
        typeof publication.scheduledChallengeId === "string" &&
        typeof publication.number === "number" &&
        window(publication.before, "opensAt", "closesAt") &&
        window(publication.after, "opensAt", "closesAt"),
    ) &&
    (value.changed === undefined || typeof value.changed === "boolean")
  );
}

async function call(
  name: "preview_superadmin_calendar_change" | "apply_superadmin_calendar_change",
  input: CalendarChangeInput,
) {
  const client = await createClient();
  const { data, error } = await client.rpc(name, {
    input: { ...input, publications: [...input.publications] },
  });
  if (error) {
    if (error.code === "42501") throw new SuperadminAccessDeniedError();
    throw new SuperadminCalendarCommandError(error.message, error);
  }
  if (!isPreview(data)) throw new SuperadminCalendarCommandError("invalid_response");
  return data;
}

export const supabaseCalendarChanges: SuperadminCalendarChanges = {
  preview: (input) => call("preview_superadmin_calendar_change", input),
  apply: (input) => call("apply_superadmin_calendar_change", input),
};
