"use client";

import { useId, useActionState, useRef, type FormEvent } from "react";

import { Button, FormField, Input, Textarea } from "@/components/ui";

import { createPortalUser, type SuperadminUserActionState } from "@/app/admin/user-actions";
import styles from "./SuperadminUserCreation.module.css";

const initialState: SuperadminUserActionState = {};

export function SuperadminUserCreation() {
  const fieldId = useId();
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

      <form
        action={action}
        onSubmit={prepareSubmission}
        className={styles.form}
        aria-busy={pending}
      >
        <input type="hidden" name="idempotencyKey" defaultValue="" />
        <FormField
          id={fieldId + "-email"}
          label="Correo electrónico"
          density="compact"
          required
          error={state.fieldErrors?.email}
          announceError
        >
          {(field) => (
            <Input
              {...field}
              name="email"
              type="email"
              autoComplete="off"
              maxLength={320}
              onChange={invalidateKey}
            />
          )}
        </FormField>
        <FormField
          id={fieldId + "-displayName"}
          label="Nombre visible"
          density="compact"
          required
          error={state.fieldErrors?.displayName}
          announceError
        >
          {(field) => (
            <Input
              {...field}
              name="displayName"
              type="text"
              minLength={2}
              maxLength={24}
              autoComplete="off"
              onChange={invalidateKey}
            />
          )}
        </FormField>
        <FormField
          id={fieldId + "-password"}
          label="Contraseña inicial"
          density="compact"
          required
          description="Usa entre 8 y 128 caracteres. No se enviará por correo."
          error={state.fieldErrors?.password}
          announceError
        >
          {(field) => (
            <Input
              {...field}
              name="password"
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              onChange={invalidateKey}
            />
          )}
        </FormField>
        <FormField
          id={fieldId + "-reason"}
          label="Motivo de auditoría"
          density="compact"
          required
          error={state.fieldErrors?.reason}
          announceError
        >
          {(field) => (
            <Textarea
              {...field}
              name="reason"
              rows={2}
              maxLength={500}
              onChange={invalidateKey}
              placeholder="Alta para la beta privada"
            />
          )}
        </FormField>

        {state.message ? (
          <p
            className={state.ok ? styles.success : styles.error}
            role={state.ok ? "status" : "alert"}
          >
            {state.message}
            {state.fieldErrors?.form ? ` ${state.fieldErrors.form}` : ""}
          </p>
        ) : null}
        <Button className={styles.submit} type="submit" size="sm" loading={pending}>
          {pending ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
    </section>
  );
}
