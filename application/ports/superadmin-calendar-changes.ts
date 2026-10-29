import type {
  CalendarChangeInput,
  CalendarChangePreview,
} from "@/types/view-models/calendar-change";

export interface SuperadminCalendarChanges {
  preview(input: CalendarChangeInput): Promise<CalendarChangePreview>;
  apply(
    input: CalendarChangeInput & { readonly idempotencyKey: string; readonly reason: string },
  ): Promise<CalendarChangePreview>;
}
