import "server-only";
import { requireSuperadmin } from "@/server/admin";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";
import { productionAdminServices } from "@/server/composition/admin";
import type { CalendarChangeInput } from "@/types/view-models/calendar-change";

export async function previewCalendarChange(input: CalendarChangeInput) {
  await requireSuperadmin();
  consumeAdminRateLimit("superadmin");
  return productionAdminServices.calendarChanges.preview(input);
}

export async function applyCalendarChange(
  input: CalendarChangeInput & { idempotencyKey: string; reason: string },
) {
  await requireSuperadmin();
  consumeAdminRateLimit("superadmin");
  return productionAdminServices.calendarChanges.apply(input);
}
