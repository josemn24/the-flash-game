"use client";

import type {
  SuperadminCalendarContext,
  SuperadminEditorialContext,
  SuperadminPortalRoom,
} from "@/types/view-models";
import { Card, Chip } from "@/components/ui";
import { CalendarScheduleDialog } from "./CalendarScheduleDialog.client";
import styles from "./CalendarManagement.module.css";

type Entry = SuperadminCalendarContext["entries"][number];
function statusLabel(status: Entry["status"]) {
  return { scheduled: "Programado", open: "Abierto", closed: "Cerrado", cancelled: "Cancelado" }[
    status
  ];
}
function statusTone(status: Entry["status"]) {
  return status === "open"
    ? ("success" as const)
    : status === "scheduled"
      ? ("info" as const)
      : ("neutral" as const);
}
function timestamp(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function CalendarEntryCard({
  entry,
  room,
  content,
  publishedContent,
  canEdit,
  variant = "detail",
}: {
  readonly entry: Entry;
  readonly room?: SuperadminPortalRoom;
  readonly content?: SuperadminEditorialContext["entries"][number];
  readonly publishedContent: readonly SuperadminEditorialContext["entries"][number][];
  readonly canEdit: boolean;
  readonly variant?: "agenda" | "detail";
}) {
  const isAgenda = variant === "agenda";
  return (
    <Card
      as="article"
      surface={isAgenda ? "surface" : "soft"}
      density={isAgenda ? "compact" : "default"}
      className={isAgenda ? styles.entryCompact : styles.entry}
    >
      <div className={styles.entryTopline}>
        <div>
          {!isAgenda ? (
            <p className={styles.eyebrow}>
              {entry.roomTitle} · {entry.seasonTitle}
            </p>
          ) : null}
          <h4>
            #{entry.number} · {entry.challengeTitle}
          </h4>
        </div>
        <Chip variant="status" tone={statusTone(entry.status)}>
          {statusLabel(entry.status)}
        </Chip>
      </div>
      <p className={styles.helper}>
        {timestamp(entry.opensAt, entry.timeZone)} – {timestamp(entry.closesAt, entry.timeZone)} · v
        {entry.versionNumber}
      </p>
      {canEdit && room ? (
        <CalendarScheduleDialog
          mode="update"
          entry={entry}
          room={room}
          publishedContent={publishedContent}
        />
      ) : null}
      {!isAgenda && content ? <span className={styles.helper}>{content.slug}</span> : null}
    </Card>
  );
}
