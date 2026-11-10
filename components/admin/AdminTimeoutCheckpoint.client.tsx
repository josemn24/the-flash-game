"use client";

import { useActionState, useId, useRef, type FormEvent } from "react";
import { Button, FormField, Textarea } from "@/components/ui";
import { randomUuid } from "@/lib/randomUuid";
import type { TimeoutCheckpointSelection } from "@/application/ports/superadmin-attempt-commands";
import {
  applySuperadminTimeoutCheckpoint,
  previewSuperadminTimeoutCheckpoint,
  type AttemptActionState,
} from "@/app/admin/attempt-actions";
import styles from "./AdminAttemptInspection.module.css";

const initialState: AttemptActionState = {};

function elapsed(milliseconds: number | null) {
  if (milliseconds === null) return "Sin aciertos";
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = String(Math.floor(milliseconds / 1_000) % 60).padStart(2, "0");
  const fraction = String(milliseconds % 1_000).padStart(3, "0");
  return `${minutes}:${seconds},${fraction}`;
}

export function AdminTimeoutCheckpoint(selection: TimeoutCheckpointSelection) {
  const reasonId = useId();
  const [previewState, previewAction, previewPending] = useActionState(
    previewSuperadminTimeoutCheckpoint,
    initialState,
  );
  const [applyState, applyAction, applyPending] = useActionState(
    applySuperadminTimeoutCheckpoint,
    initialState,
  );
  const submission = useRef<{ input: string; key: string } | null>(null);
  const preview =
    previewState.checkpointPreview?.lockVersion === selection.lockVersion
      ? previewState.checkpointPreview
      : undefined;
  const selectionFields = Object.entries(selection).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} readOnly />
  ));

  function prepareKey(event: FormEvent<HTMLFormElement>) {
    const reason = new FormData(event.currentTarget).get("reason");
    const input = JSON.stringify([selection, typeof reason === "string" ? reason.trim() : ""]);
    if (submission.current?.input !== input) submission.current = { input, key: randomUuid() };
    const field = event.currentTarget.elements.namedItem("idempotencyKey");
    if (field instanceof HTMLInputElement) field.value = submission.current.key;
  }

  return (
    <section className={styles.regradePanel} aria-label="Reconocer tablero resuelto al vencer">
      <h3>Reconocer tablero resuelto al vencer</h3>
      <form action={previewAction} className={styles.regradeForm} aria-busy={previewPending}>
        {selectionFields}
        <Button type="submit" disabled={previewPending || applyPending}>
          {previewPending ? "Comprobando…" : "Ver vista previa"}
        </Button>
      </form>
      {previewState.message ? (
        <p role="alert" className={styles.error}>
          {previewState.message}
        </p>
      ) : null}
      {preview ? (
        <>
          <dl className={styles.regradePreview} aria-label="Vista previa del reconocimiento">
            <div>
              <dt>Tablero</dt>
              <dd>
                {preview.currentPoints}/{preview.proposedPoints} → {preview.proposedPoints}/
                {preview.proposedPoints}
              </dd>
            </div>
            <div>
              <dt>Puntuación del desafío</dt>
              <dd>
                {preview.currentEffectiveScore}/100 → {preview.newEffectiveScore}/100
              </dd>
            </div>
            <div>
              <dt>Tableros resueltos</dt>
              <dd>
                {preview.solvedCount}/{preview.totalCount} → {preview.solvedCount + 1}/
                {preview.totalCount}
              </dd>
            </div>
            <div>
              <dt>Tiempo de desempate</dt>
              <dd>
                {elapsed(preview.lastCorrectElapsedMs)} → {elapsed(preview.deadlineElapsedMs)}
              </dd>
            </div>
            <div>
              <dt>Puntos de temporada</dt>
              <dd>+{preview.difference}</dd>
            </div>
          </dl>
          <form
            action={applyAction}
            className={styles.regradeForm}
            onSubmit={prepareKey}
            aria-busy={applyPending}
          >
            {selectionFields}
            <input type="hidden" name="idempotencyKey" defaultValue="" />
            <FormField
              id={reasonId}
              label="Motivo del reconocimiento"
              density="compact"
              error={applyState.fieldErrors?.reason}
              required
            >
              {(field) => <Textarea {...field} name="reason" maxLength={500} rows={3} required />}
            </FormField>
            {applyState.message ? (
              <p role="alert" className={styles.error}>
                {applyState.message}
              </p>
            ) : null}
            <Button type="submit" disabled={applyPending || previewPending}>
              {applyPending ? "Aplicando…" : "Confirmar reconocimiento"}
            </Button>
          </form>
        </>
      ) : null}
    </section>
  );
}
