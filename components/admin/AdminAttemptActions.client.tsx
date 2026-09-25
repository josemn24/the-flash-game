"use client";

import { useActionState, useEffect, useRef, type FormEvent, type MutableRefObject } from "react";
import { Button } from "@/components/ui";
import {
  adjustSuperadminAttempt,
  invalidateSuperadminAttempt,
  type AttemptActionState,
} from "@/app/admin/attempt-actions";
import styles from "./AdminAttemptInspection.module.css";

const initialState: AttemptActionState = {};

function prepareKey(event: FormEvent<HTMLFormElement>, keyRef: MutableRefObject<string | null>) {
  if (!keyRef.current) keyRef.current = globalThis.crypto.randomUUID();
  const field = event.currentTarget.elements.namedItem("idempotencyKey");
  if (field instanceof HTMLInputElement) field.value = keyRef.current;
}

export function AdminAttemptActions({
  roomId,
  scheduledChallengeId,
  attemptId,
  lockVersion,
  status,
  effectiveScore,
}: {
  readonly roomId: string;
  readonly scheduledChallengeId: string;
  readonly attemptId: string;
  readonly lockVersion: number;
  readonly status: "in_progress" | "completed" | "abandoned" | "invalidated";
  readonly effectiveScore: number;
}) {
  const [adjustState, adjustAction, adjustPending] = useActionState(
    adjustSuperadminAttempt,
    initialState,
  );
  const [invalidateState, invalidateAction, invalidatePending] = useActionState(
    invalidateSuperadminAttempt,
    initialState,
  );
  const adjustKey = useRef<string | null>(null);
  const invalidateKey = useRef<string | null>(null);
  useEffect(() => {
    if (adjustState.message) adjustKey.current = null;
  }, [adjustState.message]);
  useEffect(() => {
    if (invalidateState.message) invalidateKey.current = null;
  }, [invalidateState.message]);

  if (status !== "completed" && status !== "abandoned") {
    return (
      <p className={styles.muted}>
        Este intento es solo de lectura porque no está en un estado terminal corregible.
      </p>
    );
  }

  return (
    <div className={styles.actionGrid}>
      <form
        action={adjustAction}
        className={styles.actionForm}
        onSubmit={(event) => prepareKey(event, adjustKey)}
      >
        <h2>Ajustar resultado</h2>
        <input type="hidden" name="roomId" value={roomId} readOnly />
        <input type="hidden" name="scheduledChallengeId" value={scheduledChallengeId} readOnly />
        <input type="hidden" name="attemptId" value={attemptId} readOnly />
        <input type="hidden" name="lockVersion" value={lockVersion} readOnly />
        <input type="hidden" name="idempotencyKey" defaultValue="" />
        <label className={styles.field}>
          <span>Puntuación efectiva objetivo · actual {effectiveScore}</span>
          <input
            name="score"
            type="number"
            min="0"
            max="100"
            defaultValue={effectiveScore}
            required
          />
        </label>
        <label className={styles.field}>
          <span>Motivo de auditoría</span>
          <textarea
            name="reason"
            maxLength={500}
            required
            placeholder="Explica la corrección aplicada"
          />
        </label>
        {adjustState.message ? (
          <p className={styles.error} role="alert">
            {adjustState.message}
          </p>
        ) : null}
        <Button type="submit" loading={adjustPending}>
          Guardar ajuste
        </Button>
      </form>
      <form
        action={invalidateAction}
        className={styles.actionForm}
        onSubmit={(event) => {
          if (
            !window.confirm("¿Invalidar este intento? Se retirará su acreditación competitiva.")
          ) {
            event.preventDefault();
            return;
          }
          prepareKey(event, invalidateKey);
        }}
      >
        <h2>Invalidar intento</h2>
        <input type="hidden" name="roomId" value={roomId} readOnly />
        <input type="hidden" name="scheduledChallengeId" value={scheduledChallengeId} readOnly />
        <input type="hidden" name="attemptId" value={attemptId} readOnly />
        <input type="hidden" name="lockVersion" value={lockVersion} readOnly />
        <input type="hidden" name="idempotencyKey" defaultValue="" />
        <label className={styles.field}>
          <span>Motivo de auditoría</span>
          <textarea
            name="reason"
            maxLength={500}
            required
            placeholder="Explica por qué se invalida"
          />
        </label>
        {invalidateState.message ? (
          <p className={styles.error} role="alert">
            {invalidateState.message}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" loading={invalidatePending}>
          Invalidar
        </Button>
      </form>
    </div>
  );
}
