"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CrossIcon, FormField, Input, Select, Textarea } from "@/components/ui";
import { randomUuid } from "@/lib/randomUuid";
import { utcToLocalDateTime } from "@/lib/zonedDateTime";
import { calendarErrorMessage, type CalendarEditorRequest } from "@/lib/calendarChange";
import {
  loadCalendarChangeContext,
  submitCalendarChange,
  type CalendarChangeState,
} from "@/app/admin/calendar-change-actions";
import type {
  SuperadminPortalRoom,
  SuperadminPortalSeason,
  SuperadminCalendarEntry,
} from "@/types/view-models";
import styles from "./CalendarManagement.module.css";

type Context = Awaited<ReturnType<typeof loadCalendarChangeContext>>;

function Editor({
  context,
  seasonId,
  entryId,
  close,
}: {
  context: Context;
  seasonId: string;
  entryId?: string;
  close: () => void;
}) {
  const router = useRouter();
  const season = context.room.seasons.find((item) => item.seasonId === seasonId)!;
  const entries = context.calendar.entries.filter((item) => item.seasonId === seasonId);
  const entry = entries.find((item) => item.scheduledChallengeId === entryId);
  const timeZone = context.room.timeZone;
  const [state, action, pending] = useActionState<CalendarChangeState, FormData>(
    submitCalendarChange,
    {},
  );
  const [revision, setRevision] = useState(0);
  const [reason, setReason] = useState("");
  const [key] = useState(randomUuid);
  const [request, setRequest] = useState<CalendarEditorRequest>(() => ({
    roomId: context.room.roomId,
    seasonId,
    expectedUpdatedAt: season.updatedAt ?? "",
    expectedPublications: entries.map((item) => ({
      id: item.scheduledChallengeId,
      updatedAt: item.updatedAt,
    })),
    scheduledChallengeId: entryId,
    startsAtLocal: utcToLocalDateTime(season.startsAt, timeZone),
    endsAtLocal: utcToLocalDateTime(season.endsAt, timeZone),
    opensAtLocal: entry ? utcToLocalDateTime(entry.opensAt, timeZone) : "",
    closesAtLocal: entry ? utcToLocalDateTime(entry.closesAt, timeZone) : "",
    scope: "single",
    expandSeason: false,
  }));
  const id = useId();
  const preview = state.revision === String(revision) ? state.preview : undefined;
  const editable = entry?.calendarPermissions?.canEditWindow ?? false;
  const update = (patch: Partial<CalendarEditorRequest>) => {
    setRequest((value) => ({ ...value, ...patch }));
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    if (state.success) {
      router.refresh();
      close();
    }
  }, [state.success, router, close]);
  function dateField(
    name: "startsAtLocal" | "endsAtLocal" | "opensAtLocal" | "closesAtLocal",
    label: string,
    readOnly = false,
  ) {
    return (
      <FormField id={`${id}-${name}`} label={label} required>
        {(field) => (
          <Input
            {...field}
            type="datetime-local"
            value={request[name]}
            readOnly={readOnly}
            onChange={(event) => update({ [name]: event.target.value })}
          />
        )}
      </FormField>
    );
  }
  const format = (value: string) =>
    new Intl.DateTimeFormat("es-ES", { timeZone, dateStyle: "medium", timeStyle: "long" }).format(
      new Date(value),
    );
  return (
    <form action={action} className={styles.form} aria-busy={pending}>
      <input type="hidden" name="request" value={JSON.stringify(request)} />
      <input type="hidden" name="proposal" value={JSON.stringify(state.input ?? null)} />
      <input type="hidden" name="revision" value={revision} />
      <input type="hidden" name="idempotencyKey" value={key + ":" + revision} />
      <input type="hidden" name="roomSlug" value={context.room.slug} />
      <p className={styles.timezone}>
        {season.title} · {timeZone}. La vista previa muestra el desfase horario aplicado.
      </p>
      {entry ? (
        <>
          <p>
            #{entry.number} · {entry.challengeTitle}
          </p>
          {!editable && entry.calendarPermissions?.blockedReason ? (
            <p>{calendarErrorMessage(entry.calendarPermissions.blockedReason)}</p>
          ) : null}
          <div className={styles.dateGrid}>
            {dateField("opensAtLocal", "Apertura", !editable)}
            {dateField("closesAtLocal", "Cierre", request.scope === "following")}
          </div>
          {editable ? (
            <FormField id={`${id}-scope`} label="Aplicar a">
              {(field) => (
                <Select
                  {...field}
                  value={request.scope}
                  onChange={(event) =>
                    update({ scope: event.target.value as CalendarEditorRequest["scope"] })
                  }
                >
                  <option value="single">Solo este desafío</option>
                  <option value="following">Este desafío y los posteriores</option>
                </Select>
              )}
            </FormField>
          ) : null}
        </>
      ) : (
        <>
          <div className={styles.dateGrid}>
            {dateField("startsAtLocal", "Inicio", !season.calendarPermissions?.canEditStart)}
            {dateField("endsAtLocal", "Fin")}
          </div>
          {!season.calendarPermissions?.canEditStart ? (
            <p>El inicio está protegido porque la competición ya ha comenzado.</p>
          ) : null}
          <FormField id={`${id}-scope`} label="Fechas de los desafíos">
            {(field) => (
              <Select
                {...field}
                value={request.scope}
                onChange={(event) =>
                  update({ scope: event.target.value as CalendarEditorRequest["scope"] })
                }
              >
                <option value="single">Conservar las fechas actuales</option>
                {season.calendarPermissions?.canEditStart ? (
                  <option value="editable">
                    Desplazar todos los desafíos editables con el inicio
                  </option>
                ) : null}
              </Select>
            )}
          </FormField>
        </>
      )}
      <label>
        <input
          type="checkbox"
          checked={request.expandSeason}
          onChange={(event) => update({ expandSeason: event.target.checked })}
        />{" "}
        Ampliar los límites de la temporada si los desafíos quedan fuera
      </label>
      <FormField id={`${id}-reason`} label="Motivo del cambio" required>
        {(field) => (
          <Textarea
            {...field}
            name="reason"
            value={reason}
            maxLength={500}
            rows={2}
            onChange={(event) => {
              setReason(event.target.value);
              setRevision((value) => value + 1);
            }}
          />
        )}
      </FormField>
      {state.message ? (
        <p role="alert" className={styles.formError}>
          {state.message}
        </p>
      ) : null}
      {preview ? (
        <section aria-label="Vista previa del calendario">
          <h3>Vista previa</h3>
          <p>
            Temporada: {format(preview.season.before.startsAt)} →{" "}
            {format(preview.season.before.endsAt)}
          </p>
          <p>
            Nueva temporada: {format(preview.season.after.startsAt)} →{" "}
            {format(preview.season.after.endsAt)}
          </p>
          {preview.publications.map((publication) => (
            <div key={publication.scheduledChallengeId}>
              <p>
                <strong>Desafío #{publication.number}</strong>
              </p>
              <p>
                Antes: {format(publication.before.opensAt)} → {format(publication.before.closesAt)}
              </p>
              <p>
                Después: {format(publication.after.opensAt)} → {format(publication.after.closesAt)}
              </p>
            </div>
          ))}
        </section>
      ) : null}
      <div className={styles.formActions}>
        <Button type="button" variant="secondary" onClick={close}>
          Cancelar
        </Button>
        <Button type="submit" name="intent" value={preview ? "apply" : "preview"} loading={pending}>
          {preview ? "Guardar calendario" : "Revisar cambios"}
        </Button>
      </div>
    </form>
  );
}

export function CalendarChangeDialog({
  room,
  season,
  entry,
}: {
  readonly room: SuperadminPortalRoom;
  readonly season: SuperadminPortalSeason;
  readonly entry?: SuperadminCalendarEntry;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const id = useId();
  const label = entry
    ? entry.calendarPermissions?.canExtendClose
      ? "Ampliar cierre"
      : "Editar fechas"
    : "Reprogramar calendario";
  const close = () => {
    dialog.current?.close();
    setContext(null);
  };
  async function open() {
    dialog.current?.showModal();
    setLoading(true);
    setError(undefined);
    setContext(null);
    try {
      setContext(await loadCalendarChangeContext(room.roomId));
    } catch {
      setError("No se pudo cargar el calendario. Cierra y vuelve a intentarlo.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={open}>
        {label}
      </Button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={id}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setContext(null)}
      >
        <div className={styles.dialogSurface}>
          <header className={styles.dialogHeader}>
            <h2 id={id}>{label}</h2>
            <button
              type="button"
              className={styles.closeButton}
              aria-label="Cerrar modal"
              onClick={close}
            >
              <CrossIcon />
            </button>
          </header>
          {loading ? <p role="status">Cargando calendario…</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {context ? (
            <Editor
              context={context}
              seasonId={season.seasonId}
              entryId={entry?.scheduledChallengeId}
              close={close}
            />
          ) : null}
        </div>
      </dialog>
    </>
  );
}
