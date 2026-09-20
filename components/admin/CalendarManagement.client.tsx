"use client";

import { useState } from "react";
import { Chip } from "@/components/ui";
import type {
  SuperadminCalendarContext,
  SuperadminEditorialContext,
  SuperadminPortalRoom,
} from "@/types/view-models";
import { AdminEmptyState } from "./AdminEmptyState";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { CalendarCreateForm } from "./CalendarCreateForm.client";
import { CalendarEntryCard } from "./CalendarEntryCard.client";
import styles from "./CalendarManagement.module.css";

export function CalendarManagement({
  room,
  calendar,
  publishedContent,
}: {
  readonly room: SuperadminPortalRoom;
  readonly calendar: SuperadminCalendarContext;
  readonly publishedContent: readonly SuperadminEditorialContext["entries"][number][];
}) {
  const activeSeasons = room.seasons
    .filter((season) => season.status === "active")
    .map((season) => ({ room, season }));
  const nextNumber = (seasonId: string) =>
    Math.max(
      0,
      ...calendar.entries
        .filter((entry) => entry.seasonId === seasonId)
        .map((entry) => entry.number),
    ) + 1;
  const [renderedAt] = useState(() => Date.now());
  const editable = new Set(
    calendar.entries
      .filter(
        (entry) => entry.status === "scheduled" && new Date(entry.opensAt).getTime() > renderedAt,
      )
      .map((entry) => entry.scheduledChallengeId),
  );
  return (
    <section
      className={styles.section}
      aria-labelledby="calendar-management-title"
      aria-label={`Calendario de desafíos de ${room.title}`}
    >
      <AdminSectionHeader
        id="calendar-management-title"
        eyebrow="S12 · calendario"
        title="Programar desafíos"
        trailing={
          <Chip variant="data" tone="social">
            {calendar.entries.length} publicaciones
          </Chip>
        }
      />
      <CalendarCreateForm
        activeSeasons={activeSeasons}
        publishedContent={publishedContent}
        nextNumber={nextNumber}
      />
      <div className={styles.list}>
        <div className={styles.listHeading}>
          <h3>Calendario persistido</h3>
          <span className={styles.helper}>Las fechas se muestran en la zona de {room.title}.</span>
        </div>
        {calendar.entries.length === 0 ? (
          <AdminEmptyState>Todavía no hay publicaciones programadas.</AdminEmptyState>
        ) : (
          calendar.entries.map((entry) => (
            <CalendarEntryCard
              key={entry.scheduledChallengeId}
              entry={entry}
              room={room}
              content={publishedContent.find(
                (candidate) => candidate.challengeVersionId === entry.challengeVersionId,
              )}
              publishedContent={publishedContent}
              canEdit={editable.has(entry.scheduledChallengeId)}
            />
          ))
        )}
      </div>
    </section>
  );
}
