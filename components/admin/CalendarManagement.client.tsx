"use client";

import { useMemo, useState } from "react";

import { Chip } from "@/components/ui";
import type {
  SuperadminCalendarContext,
  SuperadminEditorialContext,
  SuperadminPortalRoom,
} from "@/types/view-models";

import { AdminEmptyState } from "./AdminEmptyState";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { CalendarEntryCard } from "./CalendarEntryCard.client";
import { CalendarScheduleDialog } from "./CalendarScheduleDialog.client";
import styles from "./CalendarManagement.module.css";

type CalendarView = "agenda" | "week" | "history";
type Entry = SuperadminCalendarContext["entries"][number];

function dateKey(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";

  return part("year") + "-" + part("month") + "-" + part("day");
}

function addDays(key: string, amount: number) {
  const date = new Date(key + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(key: string) {
  const date = new Date(key + "T12:00:00Z");
  const day = date.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  return addDays(key, -daysFromMonday);
}

function capitalized(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function dayLabel(key: string) {
  return capitalized(
    new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
      weekday: "long",
    }).format(new Date(key + "T12:00:00Z")),
  );
}

function shortDayLabel(key: string) {
  return capitalized(
    new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
      weekday: "short",
    }).format(new Date(key + "T12:00:00Z")),
  );
}

function weekLabel(key: string) {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return (
    formatter.format(new Date(key + "T12:00:00Z")) +
    " – " +
    formatter.format(new Date(addDays(key, 6) + "T12:00:00Z"))
  );
}

function currentWeek(timeZone: string) {
  return startOfWeek(dateKey(new Date(), timeZone));
}

function entryTime(entry: Entry) {
  return new Date(entry.opensAt).getTime();
}

function CalendarViewControls({
  view,
  onChange,
}: {
  readonly view: CalendarView;
  readonly onChange: (view: CalendarView) => void;
}) {
  return (
    <div className={styles.viewToolbar}>
      <div className={styles.viewToggle} role="group" aria-label="Vista del calendario">
        {(
          [
            ["agenda", "Agenda"],
            ["week", "Semana"],
            ["history", "Historial"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={view === value ? styles.viewButtonActive : styles.viewButton}
            aria-pressed={view === value}
            onClick={() => onChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AgendaView({
  entries,
  room,
  publishedContent,
  editable,
}: {
  readonly entries: readonly Entry[];
  readonly room: SuperadminPortalRoom;
  readonly publishedContent: readonly SuperadminEditorialContext["entries"][number][];
  readonly editable: ReadonlySet<string>;
}) {
  const groups = useMemo(() => {
    const grouped = new Map<string, Entry[]>();

    for (const entry of entries) {
      const key = dateKey(entry.opensAt, room.timeZone);
      const group = grouped.get(key) ?? [];
      group.push(entry);
      grouped.set(key, group);
    }

    return [...grouped.entries()];
  }, [entries, room.timeZone]);

  return (
    <div className={styles.agenda}>
      {groups.map(([key, group]) => (
        <section key={key} className={styles.agendaDay} aria-labelledby={"calendar-day-" + key}>
          <div className={styles.agendaDayHeader}>
            <h4 id={"calendar-day-" + key}>{dayLabel(key)}</h4>
            <span>
              {group.length} {group.length === 1 ? "publicación" : "publicaciones"}
            </span>
          </div>
          <div className={styles.agendaEntries}>
            {group.map((entry) => (
              <CalendarEntryCard
                key={entry.scheduledChallengeId}
                entry={entry}
                room={room}
                content={publishedContent.find(
                  (candidate) => candidate.challengeVersionId === entry.challengeVersionId,
                )}
                publishedContent={publishedContent}
                canEdit={editable.has(entry.scheduledChallengeId)}
                variant="agenda"
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function WeekView({
  entries,
  room,
  publishedContent,
  editable,
  weekStart,
  onWeekStartChange,
}: {
  readonly entries: readonly Entry[];
  readonly room: SuperadminPortalRoom;
  readonly publishedContent: readonly SuperadminEditorialContext["entries"][number][];
  readonly editable: ReadonlySet<string>;
  readonly weekStart: string;
  readonly onWeekStartChange: (key: string) => void;
}) {
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const entriesByDay = new Map<string, Entry[]>();

  for (const entry of entries) {
    const key = dateKey(entry.opensAt, room.timeZone);
    const group = entriesByDay.get(key) ?? [];
    group.push(entry);
    entriesByDay.set(key, group);
  }

  return (
    <div className={styles.weekShell}>
      <div className={styles.weekNavigation}>
        <button
          type="button"
          className={styles.navigationButton}
          onClick={() => onWeekStartChange(addDays(weekStart, -7))}
        >
          ‹ Semana anterior
        </button>
        <strong>{weekLabel(weekStart)}</strong>
        <button
          type="button"
          className={styles.navigationButton}
          onClick={() => onWeekStartChange(addDays(weekStart, 7))}
        >
          Semana siguiente ›
        </button>
      </div>
      <div className={styles.weekViewport}>
        <div className={styles.week}>
          {weekDays.map((key) => {
            const dayEntries = entriesByDay.get(key) ?? [];

            return (
              <section
                key={key}
                className={styles.weekDay}
                aria-labelledby={"calendar-week-" + key}
              >
                <div className={styles.weekDayHeader}>
                  <h4 id={"calendar-week-" + key}>{shortDayLabel(key)}</h4>
                  <span>{dayEntries.length}</span>
                </div>
                <div className={styles.weekDayEntries}>
                  {dayEntries.length > 0 ? (
                    dayEntries.map((entry) => (
                      <CalendarEntryCard
                        key={entry.scheduledChallengeId}
                        entry={entry}
                        room={room}
                        content={publishedContent.find(
                          (candidate) => candidate.challengeVersionId === entry.challengeVersionId,
                        )}
                        publishedContent={publishedContent}
                        canEdit={editable.has(entry.scheduledChallengeId)}
                        variant="week"
                      />
                    ))
                  ) : (
                    <p className={styles.weekEmpty}>Sin publicaciones</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
  const [view, setView] = useState<CalendarView>("agenda");
  const [weekStart, setWeekStart] = useState(() => currentWeek(room.timeZone));
  const sortedEntries = useMemo(
    () => [...calendar.entries].sort((left, right) => entryTime(left) - entryTime(right)),
    [calendar.entries],
  );
  const editable = useMemo(
    () =>
      new Set(
        calendar.entries
          .filter(
            (entry) =>
              entry.status === "scheduled" && new Date(entry.opensAt).getTime() > renderedAt,
          )
          .map((entry) => entry.scheduledChallengeId),
      ),
    [calendar.entries, renderedAt],
  );

  return (
    <section
      className={styles.section}
      aria-labelledby="calendar-management-title"
      aria-label={"Calendario de desafíos de " + room.title}
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
      <CalendarScheduleDialog
        mode="create"
        room={room}
        activeSeasons={activeSeasons}
        publishedContent={publishedContent}
        nextNumber={nextNumber}
      />
      <div className={styles.list}>
        <div className={styles.listHeading}>
          <div>
            <h3>Calendario persistido</h3>
            <p className={styles.helper}>
              Las fechas se muestran en la zona horaria de {room.title}.
            </p>
          </div>
          <CalendarViewControls view={view} onChange={setView} />
        </div>
        {calendar.entries.length === 0 ? (
          <AdminEmptyState>Todavía no hay publicaciones programadas.</AdminEmptyState>
        ) : view === "agenda" ? (
          <AgendaView
            entries={sortedEntries}
            room={room}
            publishedContent={publishedContent}
            editable={editable}
          />
        ) : view === "week" ? (
          <WeekView
            entries={sortedEntries}
            room={room}
            publishedContent={publishedContent}
            editable={editable}
            weekStart={weekStart}
            onWeekStartChange={setWeekStart}
          />
        ) : (
          <div className={styles.historyList}>
            {sortedEntries.map((entry) => (
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
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
