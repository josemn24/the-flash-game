"use client";

import type {
  SuperadminCalendarContext,
  SuperadminEditorialContext,
  SuperadminPortalRoom,
} from "@/types/view-models";
import Link from "next/link";
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

function time(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function challengeDetailHref(content?: SuperadminEditorialContext["entries"][number]) {
  return content ? `/admin/challenges/${content.challengeDefinitionId}` : null;
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
  readonly variant?: "agenda" | "detail" | "week";
}) {
  const isAgenda = variant === "agenda";
  const isWeek = variant === "week";
  const detailHref = challengeDetailHref(content);

  if (isWeek) {
    return (
      <Card as="article" surface="surface" density="compact" className={styles.entryWeek}>
        <div className={styles.weekEntryTopline}>
          <span className={styles.weekEntryNumber}>#{entry.number}</span>
          <Chip
            variant="status"
            tone={statusTone(entry.status)}
            className={styles.weekEntryStatus}
          >
            {statusLabel(entry.status)}
          </Chip>
        </div>
        <h4 className={styles.weekEntryTitle} title={entry.challengeTitle}>
          {detailHref ? (
            <Link
              href={detailHref}
              className={styles.entryTitleLink}
              aria-label={`Abrir detalle de ${entry.challengeTitle}`}
            >
              {entry.challengeTitle}
            </Link>
          ) : (
            entry.challengeTitle
          )}
        </h4>
        <p
          className={styles.weekEntryTime}
          aria-label={`Apertura ${time(entry.opensAt, entry.timeZone)}. Cierre ${time(entry.closesAt, entry.timeZone)}`}
        >
          {time(entry.opensAt, entry.timeZone)} – {time(entry.closesAt, entry.timeZone)}
        </p>
        {canEdit && room ? (
          <CalendarScheduleDialog
            mode="update"
            entry={entry}
            room={room}
            publishedContent={publishedContent}
            compact
          />
        ) : null}
      </Card>
    );
  }

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
            {detailHref ? (
              <Link
                href={detailHref}
                className={styles.entryTitleLink}
                aria-label={`Abrir detalle de ${entry.challengeTitle}`}
              >
                #{entry.number} · {entry.challengeTitle}
              </Link>
            ) : (
              `#${entry.number} · ${entry.challengeTitle}`
            )}
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
