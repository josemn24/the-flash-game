"use client";

import { useActionState, useRef, type FormEvent } from "react";
import { updateScheduledChallenge, type CalendarActionState } from "@/app/admin/calendar-actions";
import { utcToLocalDateTime } from "@/lib/zonedDateTime";
import type {
  SuperadminCalendarContext,
  SuperadminEditorialContext,
  SuperadminPortalRoom,
} from "@/types/view-models";
import { Button, Card, Chip } from "@/components/ui";
import styles from "./CalendarManagement.module.css";

const initialState: CalendarActionState = {};
type Entry = SuperadminCalendarContext["entries"][number];
function prepareKey(event: FormEvent<HTMLFormElement>, ref: { current: string | null }) {
  if (!ref.current) ref.current = globalThis.crypto.randomUUID();
  const input = event.currentTarget.elements.namedItem("idempotencyKey");
  if (input instanceof HTMLInputElement) input.value = ref.current;
}
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
}: {
  readonly entry: Entry;
  readonly room?: SuperadminPortalRoom;
  readonly content?: SuperadminEditorialContext["entries"][number];
  readonly publishedContent: readonly SuperadminEditorialContext["entries"][number][];
  readonly canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(updateScheduledChallenge, initialState);
  const keyRef = useRef<string | null>(null);
  return (
    <Card as="article" surface="soft" className={styles.entry}>
      <div className={styles.entryTopline}>
        <div>
          <p className={styles.eyebrow}>
            {entry.roomTitle} · {entry.seasonTitle}
          </p>
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
        <details className={styles.edit}>
          <summary>Reprogramar antes de abrir</summary>
          <form
            action={action}
            onSubmit={(event) => prepareKey(event, keyRef)}
            className={styles.form}
          >
            <input type="hidden" name="idempotencyKey" defaultValue="" />
            <input type="hidden" name="roomId" value={room.roomId} readOnly />
            <input
              type="hidden"
              name="scheduledChallengeId"
              value={entry.scheduledChallengeId}
              readOnly
            />
            <input type="hidden" name="expectedUpdatedAt" value={entry.updatedAt} readOnly />
            <label>
              <span>Contenido publicado</span>
              <select name="challengeVersionId" defaultValue={entry.challengeVersionId}>
                {publishedContent.map((candidate) => (
                  <option key={candidate.challengeVersionId} value={candidate.challengeVersionId}>
                    {candidate.title} · v{candidate.versionNumber}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Número</span>
              <input name="number" type="number" min="1" defaultValue={entry.number} required />
            </label>
            <label>
              <span>Apertura</span>
              <input
                name="opensAtLocal"
                type="datetime-local"
                defaultValue={utcToLocalDateTime(entry.opensAt, room.timeZone)}
                required
              />
            </label>
            <label>
              <span>Cierre</span>
              <input
                name="closesAtLocal"
                type="datetime-local"
                defaultValue={utcToLocalDateTime(entry.closesAt, room.timeZone)}
                required
              />
            </label>
            <label>
              <span>Motivo de auditoría</span>
              <textarea
                name="reason"
                rows={2}
                maxLength={500}
                required
                placeholder="Ajustar la ventana"
              />
            </label>
            {state.message ? (
              <p className={styles.error} role="alert">
                {state.message}
              </p>
            ) : null}
            <Button type="submit" variant="secondary" loading={pending}>
              Guardar reprogramación
            </Button>
          </form>
        </details>
      ) : null}
      {content ? <span className={styles.helper}>{content.slug}</span> : null}
    </Card>
  );
}
