"use client";

import { useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";

import {
  createScheduledChallenge,
  type CalendarActionState,
  updateScheduledChallenge,
} from "@/app/admin/calendar-actions";
import { Button, CrossIcon } from "@/components/ui";
import { utcToLocalDateTime } from "@/lib/zonedDateTime";
import type {
  SuperadminCalendarContext,
  SuperadminEditorialContext,
  SuperadminPortalRoom,
  SuperadminPortalSeason,
} from "@/types/view-models";

import styles from "./CalendarManagement.module.css";

const initialState: CalendarActionState = {};

type ActiveSeason = {
  readonly room: SuperadminPortalRoom;
  readonly season: SuperadminPortalSeason;
};

type Entry = SuperadminCalendarContext["entries"][number];

type CreateProps = {
  readonly mode: "create";
  readonly activeSeasons: readonly ActiveSeason[];
  readonly publishedContent: readonly SuperadminEditorialContext["entries"][number][];
  readonly nextNumber: (seasonId: string) => number;
  readonly room: SuperadminPortalRoom;
};

type UpdateProps = {
  readonly mode: "update";
  readonly entry: Entry;
  readonly publishedContent: readonly SuperadminEditorialContext["entries"][number][];
  readonly room: SuperadminPortalRoom;
  readonly compact?: boolean;
};

type CalendarScheduleDialogProps = CreateProps | UpdateProps;

function prepareKey(event: FormEvent<HTMLFormElement>, ref: { current: string | null }) {
  if (!ref.current) {
    ref.current = globalThis.crypto.randomUUID();
  }

  const input = event.currentTarget.elements.namedItem("idempotencyKey");

  if (input instanceof HTMLInputElement) {
    input.value = ref.current;
  }
}

function defaultLocalValue(timeZone: string, offsetMs: number) {
  return utcToLocalDateTime(new Date(Date.now() + offsetMs).toISOString(), timeZone);
}

function errorId(formId: string, field: string) {
  return formId + "-" + field + "-error";
}

function FieldError({ id, message }: { readonly id: string; readonly message?: string }) {
  return message ? (
    <small id={id} className={styles.fieldError} role="alert">
      {message}
    </small>
  ) : null;
}

function FormActions({
  pending,
  submitLabel,
  onCancel,
}: {
  readonly pending: boolean;
  readonly submitLabel: string;
  readonly onCancel: () => void;
}) {
  return (
    <div className={styles.formActions}>
      <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" size="sm" loading={pending}>
        {submitLabel}
      </Button>
    </div>
  );
}

function CreateScheduleForm({
  activeSeasons,
  publishedContent,
  nextNumber,
  onCancel,
}: {
  readonly activeSeasons: readonly ActiveSeason[];
  readonly publishedContent: readonly SuperadminEditorialContext["entries"][number][];
  readonly nextNumber: (seasonId: string) => number;
  readonly onCancel: () => void;
}) {
  const first = activeSeasons[0];
  const [seasonId, setSeasonId] = useState(first?.season.seasonId ?? "");
  const selected = activeSeasons.find(({ season }) => season.seasonId === seasonId) ?? first;
  const [state, action, pending] = useActionState(createScheduledChallenge, initialState);
  const keyRef = useRef<string | null>(null);
  const formId = useId();
  const fieldError = (field: string) => state.fieldErrors?.[field];

  if (activeSeasons.length === 0 || publishedContent.length === 0) {
    return (
      <div className={styles.dialogBody}>
        <p className={styles.helper}>
          Necesitas una temporada activa y contenido Flash publicado para programar.
        </p>
        <div className={styles.formActions}>
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      key={selected?.season.seasonId ?? "no-season"}
      action={action}
      onSubmit={(event) => prepareKey(event, keyRef)}
      className={styles.form}
    >
      <input type="hidden" name="idempotencyKey" defaultValue="" />

      <fieldset className={styles.group}>
        <legend>Contenido</legend>

        <label htmlFor={formId + "-seasonId"}>
          <span>Temporada activa</span>
          <select
            id={formId + "-seasonId"}
            name="seasonId"
            value={selected?.season.seasonId ?? ""}
            onChange={(event) => setSeasonId(event.target.value)}
            data-dialog-autofocus
            aria-invalid={Boolean(fieldError("seasonId"))}
            aria-describedby={fieldError("seasonId") ? errorId(formId, "seasonId") : undefined}
          >
            {activeSeasons.map(({ room, season }) => (
              <option key={season.seasonId} value={season.seasonId}>
                {room.title} · {season.title}
              </option>
            ))}
          </select>
          <FieldError id={errorId(formId, "seasonId")} message={fieldError("seasonId")} />
        </label>

        <label htmlFor={formId + "-challengeVersionId"}>
          <span>Contenido publicado</span>
          <select
            id={formId + "-challengeVersionId"}
            name="challengeVersionId"
            defaultValue={publishedContent[0]?.challengeVersionId}
            aria-invalid={Boolean(fieldError("challengeVersionId"))}
            aria-describedby={
              fieldError("challengeVersionId") ? errorId(formId, "challengeVersionId") : undefined
            }
          >
            {publishedContent.map((entry) => (
              <option key={entry.challengeVersionId} value={entry.challengeVersionId}>
                {entry.title} · v{entry.versionNumber}
              </option>
            ))}
          </select>
          <FieldError
            id={errorId(formId, "challengeVersionId")}
            message={fieldError("challengeVersionId")}
          />
        </label>

        <label className={styles.numberField} htmlFor={formId + "-number"}>
          <span>Número</span>
          <input
            id={formId + "-number"}
            name="number"
            type="number"
            min="1"
            defaultValue={selected ? nextNumber(selected.season.seasonId) : 1}
            required
            aria-invalid={Boolean(fieldError("number"))}
            aria-describedby={fieldError("number") ? errorId(formId, "number") : undefined}
          />
          <FieldError id={errorId(formId, "number")} message={fieldError("number")} />
        </label>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Ventana temporal</legend>

        <p className={styles.timezone}>
          Las fechas se guardarán en la zona horaria de la sala: {selected?.room.timeZone ?? "—"}
        </p>

        <div className={styles.dateGrid}>
          <label htmlFor={formId + "-opensAtLocal"}>
            <span>Apertura</span>
            <input
              id={formId + "-opensAtLocal"}
              name="opensAtLocal"
              type="datetime-local"
              defaultValue={selected ? defaultLocalValue(selected.room.timeZone, 3_600_000) : ""}
              required
              aria-invalid={Boolean(fieldError("opensAtLocal"))}
              aria-describedby={
                fieldError("opensAtLocal") ? errorId(formId, "opensAtLocal") : undefined
              }
            />
            <FieldError id={errorId(formId, "opensAtLocal")} message={fieldError("opensAtLocal")} />
          </label>

          <label htmlFor={formId + "-closesAtLocal"}>
            <span>Cierre</span>
            <input
              id={formId + "-closesAtLocal"}
              name="closesAtLocal"
              type="datetime-local"
              defaultValue={selected ? defaultLocalValue(selected.room.timeZone, 7_200_000) : ""}
              required
              aria-invalid={Boolean(fieldError("closesAtLocal"))}
              aria-describedby={
                fieldError("closesAtLocal") ? errorId(formId, "closesAtLocal") : undefined
              }
            />
            <FieldError
              id={errorId(formId, "closesAtLocal")}
              message={fieldError("closesAtLocal")}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Auditoría</legend>

        <label htmlFor={formId + "-reason"}>
          <span>Motivo de auditoría</span>
          <textarea
            id={formId + "-reason"}
            name="reason"
            rows={2}
            maxLength={500}
            required
            placeholder="Programar el desafío de la beta"
            aria-invalid={Boolean(fieldError("reason"))}
            aria-describedby={fieldError("reason") ? errorId(formId, "reason") : undefined}
          />
          <FieldError id={errorId(formId, "reason")} message={fieldError("reason")} />
        </label>
      </fieldset>

      {state.message || state.fieldErrors?.form ? (
        <p className={styles.formError} role="alert">
          {state.fieldErrors?.form ?? state.message}
        </p>
      ) : null}

      <FormActions pending={pending} submitLabel="Programar desafío" onCancel={onCancel} />
    </form>
  );
}

function UpdateScheduleForm({
  entry,
  room,
  publishedContent,
  onCancel,
}: {
  readonly entry: Entry;
  readonly room: SuperadminPortalRoom;
  readonly publishedContent: readonly SuperadminEditorialContext["entries"][number][];
  readonly onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(updateScheduledChallenge, initialState);
  const keyRef = useRef<string | null>(null);
  const formId = useId();
  const fieldError = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={action} onSubmit={(event) => prepareKey(event, keyRef)} className={styles.form}>
      <input type="hidden" name="idempotencyKey" defaultValue="" />
      <input type="hidden" name="roomId" value={room.roomId} readOnly />
      <input
        type="hidden"
        name="scheduledChallengeId"
        value={entry.scheduledChallengeId}
        readOnly
      />
      <input type="hidden" name="expectedUpdatedAt" value={entry.updatedAt} readOnly />

      <fieldset className={styles.group}>
        <legend>Publicación</legend>

        <p className={styles.dialogContext}>
          {entry.roomTitle} · {entry.seasonTitle} · #{entry.number}
        </p>

        <label htmlFor={formId + "-challengeVersionId"}>
          <span>Contenido publicado</span>
          <select
            id={formId + "-challengeVersionId"}
            name="challengeVersionId"
            defaultValue={entry.challengeVersionId}
            data-dialog-autofocus
            aria-invalid={Boolean(fieldError("challengeVersionId"))}
            aria-describedby={
              fieldError("challengeVersionId") ? errorId(formId, "challengeVersionId") : undefined
            }
          >
            {publishedContent.map((candidate) => (
              <option key={candidate.challengeVersionId} value={candidate.challengeVersionId}>
                {candidate.title} · v{candidate.versionNumber}
              </option>
            ))}
          </select>
          <FieldError
            id={errorId(formId, "challengeVersionId")}
            message={fieldError("challengeVersionId")}
          />
        </label>

        <label className={styles.numberField} htmlFor={formId + "-number"}>
          <span>Número</span>
          <input
            id={formId + "-number"}
            name="number"
            type="number"
            min="1"
            defaultValue={entry.number}
            required
            aria-invalid={Boolean(fieldError("number"))}
            aria-describedby={fieldError("number") ? errorId(formId, "number") : undefined}
          />
          <FieldError id={errorId(formId, "number")} message={fieldError("number")} />
        </label>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Ventana temporal</legend>

        <p className={styles.timezone}>
          Las fechas se guardarán en la zona horaria de la sala: {room.timeZone}
        </p>

        <div className={styles.dateGrid}>
          <label htmlFor={formId + "-opensAtLocal"}>
            <span>Apertura</span>
            <input
              id={formId + "-opensAtLocal"}
              name="opensAtLocal"
              type="datetime-local"
              defaultValue={utcToLocalDateTime(entry.opensAt, room.timeZone)}
              required
              aria-invalid={Boolean(fieldError("opensAtLocal"))}
              aria-describedby={
                fieldError("opensAtLocal") ? errorId(formId, "opensAtLocal") : undefined
              }
            />
            <FieldError id={errorId(formId, "opensAtLocal")} message={fieldError("opensAtLocal")} />
          </label>

          <label htmlFor={formId + "-closesAtLocal"}>
            <span>Cierre</span>
            <input
              id={formId + "-closesAtLocal"}
              name="closesAtLocal"
              type="datetime-local"
              defaultValue={utcToLocalDateTime(entry.closesAt, room.timeZone)}
              required
              aria-invalid={Boolean(fieldError("closesAtLocal"))}
              aria-describedby={
                fieldError("closesAtLocal") ? errorId(formId, "closesAtLocal") : undefined
              }
            />
            <FieldError
              id={errorId(formId, "closesAtLocal")}
              message={fieldError("closesAtLocal")}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Auditoría</legend>

        <label htmlFor={formId + "-reason"}>
          <span>Motivo de auditoría</span>
          <textarea
            id={formId + "-reason"}
            name="reason"
            rows={2}
            maxLength={500}
            required
            placeholder="Ajustar la ventana"
            aria-invalid={Boolean(fieldError("reason"))}
            aria-describedby={fieldError("reason") ? errorId(formId, "reason") : undefined}
          />
          <FieldError id={errorId(formId, "reason")} message={fieldError("reason")} />
        </label>
      </fieldset>

      {state.message || state.fieldErrors?.form ? (
        <p className={styles.formError} role="alert">
          {state.fieldErrors?.form ?? state.message}
        </p>
      ) : null}

      <FormActions pending={pending} submitLabel="Guardar reprogramación" onCancel={onCancel} />
    </form>
  );
}

export function CalendarScheduleDialog(props: CalendarScheduleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      dialog.querySelector<HTMLElement>("[data-dialog-autofocus]")?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  function closeDialog() {
    dialogRef.current?.close();
    setOpen(false);
  }

  const isCreate = props.mode === "create";

  return (
    <>
      {isCreate ? (
        <button type="button" className={styles.createTrigger} onClick={() => setOpen(true)}>
          <span className={styles.createTriggerIcon} aria-hidden="true">
            +
          </span>
          <span>Programar nuevo desafío</span>
        </button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={props.compact ? styles.weekEntryAction : undefined}
          onClick={() => setOpen(true)}
        >
          Reprogramar
        </Button>
      )}

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeDialog();
          }
        }}
      >
        {open ? (
          <div className={styles.dialogSurface}>
            <header className={styles.dialogHeader}>
              <div>
                <p className={styles.eyebrow}>
                  {isCreate ? "Nueva programación" : "Edición de calendario"}
                </p>
                <h2 id={titleId}>{isCreate ? "Programar desafío" : "Reprogramar desafío"}</h2>
                <p id={descriptionId} className={styles.dialogDescription}>
                  {isCreate
                    ? "Configura el contenido y la ventana temporal de la publicación."
                    : "Ajusta la publicación mientras todavía no ha comenzado."}
                </p>
              </div>
              <button
                className={styles.closeButton}
                type="button"
                onClick={closeDialog}
                aria-label="Cerrar modal"
              >
                <CrossIcon />
              </button>
            </header>
            {isCreate ? (
              <CreateScheduleForm
                activeSeasons={props.activeSeasons}
                publishedContent={props.publishedContent}
                nextNumber={props.nextNumber}
                onCancel={closeDialog}
              />
            ) : (
              <UpdateScheduleForm
                entry={props.entry}
                room={props.room}
                publishedContent={props.publishedContent}
                onCancel={closeDialog}
              />
            )}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
