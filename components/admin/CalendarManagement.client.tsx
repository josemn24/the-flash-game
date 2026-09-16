"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import { Button, Card, Chip } from "@/components/ui";
import { createScheduledChallenge, updateScheduledChallenge, type CalendarActionState } from "@/app/admin/calendar-actions";
import { utcToLocalDateTime } from "@/lib/zonedDateTime";
import type { SuperadminCalendarContext, SuperadminPortalContext } from "@/types/view-models";
import styles from "./CalendarManagement.module.css";

const initialState: CalendarActionState = {};

function key() {
  return globalThis.crypto.randomUUID();
}

function prepareKey(event: FormEvent<HTMLFormElement>, ref: { current: string | null }) {
  if (!ref.current) ref.current = key();
  const input = event.currentTarget.elements.namedItem("idempotencyKey");
  if (input instanceof HTMLInputElement) input.value = ref.current;
}

function timestamp(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}

function stateError(state: CalendarActionState) {
  if (!state.message) return null;
  return <p className={styles.error} role="alert">{state.message}</p>;
}

function statusLabel(status: SuperadminCalendarContext["entries"][number]["status"]) {
  return { scheduled: "Programado", open: "Abierto", closed: "Cerrado", cancelled: "Cancelado" }[status];
}

function statusTone(status: SuperadminCalendarContext["entries"][number]["status"]) {
  return status === "open" ? "success" as const : status === "scheduled" ? "info" as const : "neutral" as const;
}

function defaultLocalValue(timeZone: string, offsetMs: number) {
  return utcToLocalDateTime(new Date(Date.now() + offsetMs).toISOString(), timeZone);
}

export function CalendarManagement({
  context,
  calendar,
}: {
  readonly context: SuperadminPortalContext;
  readonly calendar: SuperadminCalendarContext;
}) {
  const activeSeasons = context.rooms.flatMap((room) =>
    room.seasons.filter((season) => season.status === "active").map((season) => ({ room, season })),
  );
  const publishedContent = context.editorial?.entries.filter((entry) => entry.status === "published") ?? [];
  const firstSeason = activeSeasons[0];
  const firstRoom = firstSeason?.room;
  const nextNumber = (seasonId: string) => Math.max(0, ...calendar.entries.filter((entry) => entry.seasonId === seasonId).map((entry) => entry.number)) + 1;
  const [seasonId, setSeasonId] = useState(firstSeason?.season.seasonId ?? "");
  const selectedSeason = activeSeasons.find(({ season }) => season.seasonId === seasonId) ?? firstSeason;
  const selectedRoom = selectedSeason?.room ?? firstRoom;
  const [createState, createAction, createPending] = useActionState(createScheduledChallenge, initialState);
  const [updateState, updateAction, updatePending] = useActionState(updateScheduledChallenge, initialState);
  const createKeyRef = useRef<string | null>(null);
  const updateKeyRef = useRef<string | null>(null);
  const [renderedAt] = useState(() => Date.now());
  const editable = calendar.entries.filter((entry) => entry.status === "scheduled" && new Date(entry.opensAt).getTime() > renderedAt);

  return (
    <section className={styles.section} aria-labelledby="calendar-management-title" aria-label="Calendario de desafíos">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>S12 · calendario</p>
          <h2 id="calendar-management-title">Programar desafíos</h2>
        </div>
        <Chip variant="data" tone="social">{calendar.entries.length} publicaciones</Chip>
      </div>

      <Card as="section" className={styles.card} aria-labelledby="calendar-create-title">
        <p className={styles.eyebrow}>Ventana temporal</p>
        <h3 id="calendar-create-title">Nueva publicación</h3>
        {activeSeasons.length === 0 || publishedContent.length === 0 ? (
          <p className={styles.helper}>Necesitas una temporada activa y contenido Flash publicado para programar.</p>
        ) : (
          <form key={selectedSeason?.season.seasonId ?? "no-season"} action={createAction} onSubmit={(event) => prepareKey(event, createKeyRef)} className={styles.form}>
            <input type="hidden" name="idempotencyKey" defaultValue="" />
            <label><span>Temporada activa</span><select name="seasonId" value={selectedSeason?.season.seasonId ?? ""} onChange={(event) => setSeasonId(event.target.value)}>{activeSeasons.map(({ room, season }) => <option key={season.seasonId} value={season.seasonId}>{room.title} · {season.title}</option>)}</select></label>
            <label><span>Contenido publicado</span><select name="challengeVersionId" defaultValue={publishedContent[0]?.challengeVersionId}>{publishedContent.map((entry) => <option key={entry.challengeVersionId} value={entry.challengeVersionId}>{entry.title} · v{entry.versionNumber}</option>)}</select></label>
            <label><span>Número</span><input name="number" type="number" min="1" defaultValue={selectedSeason ? nextNumber(selectedSeason.season.seasonId) : 1} required /></label>
            <p className={styles.helper}>Zona horaria: {selectedRoom?.timeZone ?? "—"}</p>
            <label><span>Apertura</span><input name="opensAtLocal" type="datetime-local" defaultValue={selectedRoom ? defaultLocalValue(selectedRoom.timeZone, 3_600_000) : ""} required /></label>
            <label><span>Cierre</span><input name="closesAtLocal" type="datetime-local" defaultValue={selectedRoom ? defaultLocalValue(selectedRoom.timeZone, 7_200_000) : ""} required /></label>
            <label><span>Motivo de auditoría</span><textarea name="reason" rows={2} maxLength={500} required placeholder="Programar el desafío de la beta" /></label>
            {stateError(createState)}
            <Button type="submit" loading={createPending}>Programar desafío</Button>
          </form>
        )}
      </Card>

      <div className={styles.list}>
        <div className={styles.listHeading}><h3>Calendario persistido</h3><span className={styles.helper}>Las fechas se muestran en la zona de cada sala.</span></div>
        {calendar.entries.length === 0 ? <p className={styles.helper}>Todavía no hay publicaciones programadas.</p> : calendar.entries.map((entry) => {
          const canEdit = editable.some(({ scheduledChallengeId }) => scheduledChallengeId === entry.scheduledChallengeId);
          const room = context.rooms.find((candidate) => candidate.roomId === entry.roomId);
          const content = publishedContent.find((candidate) => candidate.challengeVersionId === entry.challengeVersionId);
          return (
            <Card as="article" surface="soft" key={entry.scheduledChallengeId} className={styles.entry}>
              <div className={styles.entryTopline}><div><p className={styles.eyebrow}>{entry.roomTitle} · {entry.seasonTitle}</p><h4>#{entry.number} · {entry.challengeTitle}</h4></div><Chip variant="status" tone={statusTone(entry.status)}>{statusLabel(entry.status)}</Chip></div>
              <p className={styles.helper}>{timestamp(entry.opensAt, entry.timeZone)} – {timestamp(entry.closesAt, entry.timeZone)} · v{entry.versionNumber}</p>
              {canEdit && room ? (
                <details className={styles.edit}><summary>Reprogramar antes de abrir</summary><form action={updateAction} onSubmit={(event) => prepareKey(event, updateKeyRef)} className={styles.form}>
                  <input type="hidden" name="idempotencyKey" defaultValue="" /><input type="hidden" name="scheduledChallengeId" value={entry.scheduledChallengeId} readOnly /><input type="hidden" name="expectedUpdatedAt" value={entry.updatedAt} readOnly />
                  <label><span>Contenido publicado</span><select name="challengeVersionId" defaultValue={entry.challengeVersionId}>{publishedContent.map((candidate) => <option key={candidate.challengeVersionId} value={candidate.challengeVersionId}>{candidate.title} · v{candidate.versionNumber}</option>)}</select></label>
                  <label><span>Número</span><input name="number" type="number" min="1" defaultValue={entry.number} required /></label>
                  <label><span>Apertura</span><input name="opensAtLocal" type="datetime-local" defaultValue={utcToLocalDateTime(entry.opensAt, room.timeZone)} required /></label>
                  <label><span>Cierre</span><input name="closesAtLocal" type="datetime-local" defaultValue={utcToLocalDateTime(entry.closesAt, room.timeZone)} required /></label>
                  <label><span>Motivo de auditoría</span><textarea name="reason" rows={2} maxLength={500} required placeholder="Ajustar la ventana" /></label>
                  {stateError(updateState)}<Button type="submit" variant="secondary" loading={updatePending}>Guardar reprogramación</Button>
                </form></details>
              ) : null}
              {content ? <span className={styles.helper}>{content.slug}</span> : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
