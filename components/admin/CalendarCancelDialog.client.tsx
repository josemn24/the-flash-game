"use client";

import { FormField, Textarea, Button, CrossIcon } from "@/components/ui";

import { useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";

import { cancelScheduledChallenge, type CalendarActionState } from "@/app/admin/calendar-actions";

import type { SuperadminCalendarContext, SuperadminPortalRoom } from "@/types/view-models";

import styles from "./CalendarManagement.module.css";

const initialState: CalendarActionState = {};
type Entry = SuperadminCalendarContext["entries"][number];

function prepareKey(event: FormEvent<HTMLFormElement>, ref: { current: string | null }) {
  if (!ref.current) ref.current = globalThis.crypto.randomUUID();
  const input = event.currentTarget.elements.namedItem("idempotencyKey");
  if (input instanceof HTMLInputElement) input.value = ref.current;
}

function timestamp(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function CalendarCancelDialog({
  entry,
  room,
  compact = false,
}: {
  readonly entry: Entry;
  readonly room: SuperadminPortalRoom;
  readonly compact?: boolean;
}) {
  const [state, action, pending] = useActionState(cancelScheduledChallenge, initialState);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const keyRef = useRef<string | null>(null);
  const formId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-dialog-autofocus]")?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  function closeDialog() {
    dialogRef.current?.close();
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={compact ? styles.weekEntryAction : undefined}
        onClick={() => setOpen(true)}
      >
        Cancelar
      </Button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={`${formId}-title`}
        aria-describedby={`${formId}-description`}
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        {open ? (
          <div className={styles.dialogSurface}>
            <header className={styles.dialogHeader}>
              <div>
                <p className={styles.eyebrow}>Operación de calendario</p>
                <h2 id={`${formId}-title`}>Cancelar programación</h2>
                <p id={`${formId}-description`} className={styles.dialogDescription}>
                  Esta acción retira el desafío antes de su apertura y no se puede deshacer.
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

            <form
              action={action}
              className={styles.form}
              onSubmit={(event) => prepareKey(event, keyRef)}
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
                  <br />
                  {entry.challengeTitle}
                  <br />
                  {timestamp(entry.opensAt, room.timeZone)} –{" "}
                  {timestamp(entry.closesAt, room.timeZone)}
                </p>
                <p className={styles.cancelWarning}>
                  La publicación permanecerá en el historial como cancelada y no podrá abrirse ni
                  reprogramarse.
                </p>
              </fieldset>

              <fieldset className={styles.group}>
                <legend>Auditoría</legend>
                <FormField
                  id={formId + "-reason"}
                  label="Motivo de cancelación"
                  density="compact"
                  required
                  error={state.fieldErrors?.reason}
                  announceError
                >
                  {(field) => (
                    <Textarea
                      {...field}
                      name="reason"
                      rows={3}
                      maxLength={500}
                      data-dialog-autofocus
                      placeholder="Contenido retirado por revisión"
                    />
                  )}
                </FormField>
              </fieldset>

              {state.message || state.fieldErrors?.form ? (
                <p className={styles.formError} role="alert">
                  {state.fieldErrors?.form ?? state.message}
                </p>
              ) : null}

              <div className={styles.formActions}>
                <Button type="button" variant="secondary" size="sm" onClick={closeDialog}>
                  Conservar programación
                </Button>
                <Button type="submit" variant="secondary" size="sm" loading={pending}>
                  Confirmar cancelación
                </Button>
              </div>
            </form>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
