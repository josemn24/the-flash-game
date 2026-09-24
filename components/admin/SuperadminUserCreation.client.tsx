"use client";

import { useActionState, useRef, type FormEvent } from "react";
import { createPortalUser, type SuperadminUserActionState } from "@/app/admin/user-actions";
import styles from "./SuperadminUserCreation.module.css";

const initialState: SuperadminUserActionState = {};

export function SuperadminUserCreation() {
  const [state, action, pending] = useActionState(createPortalUser, initialState);
  const keyRef = useRef<string | null>(null);

  function prepareSubmission(event: FormEvent<HTMLFormElement>) {
    keyRef.current ??= globalThis.crypto.randomUUID();
    const keyField = event.currentTarget.elements.namedItem("idempotencyKey");
    if (keyField instanceof HTMLInputElement) keyField.value = keyRef.current;
  }

  function invalidateKey() {
    keyRef.current = null;
  }

  return (
    <section className={styles.section} aria-labelledby="create-user-title">
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Alta directa · sin correo</p>
        <h1 id="create-user-title">Crear usuario</h1>
        <p>La cuenta quedará confirmada y podrá acceder con esta contraseña.</p>
      </header>

      <form action={action} onSubmit={prepareSubmission} className={styles.form}>
        <input type="hidden" name="idempotencyKey" defaultValue="" />
        <label className={styles.field}>
          <span>Correo electrónico</span>
          <input
            name="email"
            type="email"
            autoComplete="off"
            maxLength={320}
            required
            onChange={invalidateKey}
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
          {state.fieldErrors?.email ? <small role="alert">{state.fieldErrors.email}</small> : null}
        </label>
        <label className={styles.field}>
          <span>Nombre visible</span>
          <input
            name="displayName"
            type="text"
            minLength={2}
            maxLength={24}
            autoComplete="off"
            required
            onChange={invalidateKey}
            aria-invalid={Boolean(state.fieldErrors?.displayName)}
          />
          {state.fieldErrors?.displayName ? (
            <small role="alert">{state.fieldErrors.displayName}</small>
          ) : null}
        </label>
        <label className={styles.field}>
          <span>Contraseña inicial</span>
          <input
            name="password"
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
            onChange={invalidateKey}
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
          {state.fieldErrors?.password ? (
            <small role="alert">{state.fieldErrors.password}</small>
          ) : null}
          <small>Usa entre 8 y 128 caracteres. No se enviará por correo.</small>
        </label>
        <label className={styles.field}>
          <span>Motivo de auditoría</span>
          <textarea
            name="reason"
            rows={2}
            maxLength={500}
            required
            onChange={invalidateKey}
            placeholder="Alta para la beta privada"
            aria-invalid={Boolean(state.fieldErrors?.reason)}
          />
          {state.fieldErrors?.reason ? (
            <small role="alert">{state.fieldErrors.reason}</small>
          ) : null}
        </label>

        {state.message ? (
          <p
            className={state.ok ? styles.success : styles.error}
            role={state.ok ? "status" : "alert"}
          >
            {state.message}
            {state.fieldErrors?.form ? ` ${state.fieldErrors.form}` : ""}
          </p>
        ) : null}
        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
    </section>
  );
}
