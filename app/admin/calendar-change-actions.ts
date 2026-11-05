"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/server/admin";
import { getSuperadminCalendarContext } from "@/server/admin-calendar";
import { previewCalendarChange, applyCalendarChange } from "@/server/admin-calendar-changes";
import {
  buildCalendarChange,
  calendarErrorMessage,
  type CalendarEditorRequest,
} from "@/lib/calendarChange";
import type {
  CalendarChangeInput,
  CalendarChangePreview,
} from "@/types/view-models/calendar-change";
import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
} from "@/application/administration/errors";

export type CalendarChangeState = {
  revision?: string;
  preview?: CalendarChangePreview;
  input?: CalendarChangeInput;
  message?: string;
  success?: boolean;
};

export async function loadCalendarChangeContext(roomId: string) {
  const access = await requireSuperadmin();
  const room = access.context.rooms.find((candidate) => candidate.roomId === roomId);
  if (!room) throw new Error("room_not_found");
  const calendar = await getSuperadminCalendarContext(roomId);
  return { room, calendar };
}

export async function submitCalendarChange(
  _state: CalendarChangeState,
  form: FormData,
): Promise<CalendarChangeState> {
  const revision = String(form.get("revision") ?? "");
  try {
    const access = await requireSuperadmin();
    if (form.get("intent") === "apply") {
      const input = JSON.parse(String(form.get("proposal"))) as CalendarChangeInput;
      const result = await applyCalendarChange({
        ...input,
        idempotencyKey: String(form.get("idempotencyKey") ?? ""),
        reason: String(form.get("reason") ?? "").trim(),
      });
      const slug = access.context.rooms.find((room) => room.roomId === result.roomId)?.slug;
      for (const path of [
        "/admin",
        "/admin/rooms",
        `/admin/rooms/${result.roomId}`,
        `/admin/rooms/${result.roomId}/measurement`,
        "/salas",
        ...(slug ? [`/salas/${slug}`] : []),
      ])
        revalidatePath(path);
      return { revision, success: true };
    }
    const request = JSON.parse(String(form.get("request"))) as CalendarEditorRequest;
    const { room, calendar } = await loadCalendarChangeContext(request.roomId);
    const input = buildCalendarChange(request, room, calendar.entries);
    const preview = await previewCalendarChange(input);
    return { revision, input, preview };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SuperadminAccessDeniedError
    )
      throw error;
    return { revision, message: calendarErrorMessage(error instanceof Error ? error.message : "") };
  }
}
