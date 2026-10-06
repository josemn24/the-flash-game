"use client";

import { FormField, Select, Input, Textarea, Button, CrossIcon } from "@/components/ui";

import { useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";

import {
  createScheduledChallenge,
  type CalendarActionState,
  updateScheduledChallenge,
} from "@/app/admin/calendar-actions";

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
      aria-busy={pending}
    >
      <input type="hidden" name="idempotencyKey" defaultValue="" />

      <fieldset className={styles.group}>
        <legend>Contenido</legend>

        <FormField
          id={formId + "-seasonId"}
          label="Temporada activa"
          density="compact"
          error={fieldError("seasonId")}
          announceError
        >
          {(field) => (
            <Select
              {...field}
              name="seasonId"
              value={selected?.season.seasonId ?? ""}
              onChange={(event) => setSeasonId(event.target.value)}
              data-dialog-autofocus
            >
              {activeSeasons.map(({ room, season }) => (
                <option key={season.seasonId} value={season.seasonId}>
                  {room.title} · {season.title}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          id={formId + "-challengeVersionId"}
          label="Contenido publicado"
          density="compact"
          error={fieldError("challengeVersionId")}
          announceError
        >
          {(field) => (
            <Select
              {...field}
              name="challengeVersionId"
              defaultValue={publishedContent[0]?.challengeVersionId}
            >
              {publishedContent.map((entry) => (
                <option key={entry.challengeVersionId} value={entry.challengeVersionId}>
                  {entry.title} · v{entry.versionNumber}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          id={formId + "-number"}
          label="Número"
          density="compact"
          required
          error={fieldError("number")}
          announceError
          className={styles.numberField}
        >
          {(field) => (
            <Input
              {...field}
              name="number"
              type="number"
              min="1"
              defaultValue={selected ? nextNumber(selected.season.seasonId) : 1}
            />
          )}
        </FormField>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Ventana temporal</legend>

        <p className={styles.timezone}>
          Las fechas se guardarán en la zona horaria de la sala: {selected?.room.timeZone ?? "—"}
        </p>

        <div className={styles.dateGrid}>
          <FormField
            id={formId + "-opensAtLocal"}
            label="Apertura"
            density="compact"
            required
            error={fieldError("opensAtLocal")}
            announceError
          >
            {(field) => (
              <Input
                {...field}
                name="opensAtLocal"
                type="datetime-local"
                defaultValue={selected ? defaultLocalValue(selected.room.timeZone, 3_600_000) : ""}
              />
            )}
          </FormField>

          <FormField
            id={formId + "-closesAtLocal"}
            label="Cierre"
            density="compact"
            required
            error={fieldError("closesAtLocal")}
            announceError
          >
            {(field) => (
              <Input
                {...field}
                name="closesAtLocal"
                type="datetime-local"
                defaultValue={selected ? defaultLocalValue(selected.room.timeZone, 7_200_000) : ""}
              />
            )}
          </FormField>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Auditoría</legend>

        <FormField
          id={formId + "-reason"}
          label="Motivo de auditoría"
          density="compact"
          required
          error={fieldError("reason")}
          announceError
        >
          {(field) => (
            <Textarea
              {...field}
              name="reason"
              rows={2}
              maxLength={500}
              placeholder="Programar el desafío de la beta"
            />
          )}
        </FormField>
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
    <form
      action={action}
      onSubmit={(event) => prepareKey(event, keyRef)}
      className={styles.form}
      aria-busy={pending}
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

      <fieldset className={styles.group}>
        <legend>Publicación</legend>

        <p className={styles.dialogContext}>
          {entry.roomTitle} · {entry.seasonTitle} · #{entry.number}
        </p>

        <FormField
          id={formId + "-challengeVersionId"}
          label="Contenido publicado"
          density="compact"
          error={fieldError("challengeVersionId")}
          announceError
        >
          {(field) => (
            <Select
              {...field}
              name="challengeVersionId"
              defaultValue={entry.challengeVersionId}
              data-dialog-autofocus
            >
              {publishedContent.map((candidate) => (
                <option key={candidate.challengeVersionId} value={candidate.challengeVersionId}>
                  {candidate.title} · v{candidate.versionNumber}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          id={formId + "-number"}
          label="Número"
          density="compact"
          required
          error={fieldError("number")}
          announceError
          className={styles.numberField}
        >
          {(field) => (
            <Input {...field} name="number" type="number" min="1" defaultValue={entry.number} />
          )}
        </FormField>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Ventana temporal</legend>

        <p className={styles.timezone}>
          Las fechas se guardarán en la zona horaria de la sala: {room.timeZone}
        </p>

        <div className={styles.dateGrid}>
          <FormField
            id={formId + "-opensAtLocal"}
            label="Apertura"
            density="compact"
            required
            error={fieldError("opensAtLocal")}
            announceError
          >
            {(field) => (
              <Input
                {...field}
                name="opensAtLocal"
                type="datetime-local"
                defaultValue={utcToLocalDateTime(entry.opensAt, room.timeZone)}
              />
            )}
          </FormField>

          <FormField
            id={formId + "-closesAtLocal"}
            label="Cierre"
            density="compact"
            required
            error={fieldError("closesAtLocal")}
            announceError
          >
            {(field) => (
              <Input
                {...field}
                name="closesAtLocal"
                type="datetime-local"
                defaultValue={utcToLocalDateTime(entry.closesAt, room.timeZone)}
              />
            )}
          </FormField>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Auditoría</legend>

        <FormField
          id={formId + "-reason"}
          label="Motivo de auditoría"
          density="compact"
          required
          error={fieldError("reason")}
          announceError
        >
          {(field) => (
            <Textarea
              {...field}
              name="reason"
              rows={2}
              maxLength={500}
              placeholder="Ajustar la ventana"
            />
          )}
        </FormField>
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
