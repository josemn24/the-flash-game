"use client";

import { useId, useActionState, useRef, useState, useTransition, type FormEvent } from "react";

import { Button, FormField, Input, Select, Textarea } from "@/components/ui";

import {
  addPortalUserToRoom,
  lookupPortalUserByEmail,
  type SuperadminUserActionState,
} from "@/app/admin/user-actions";
import type { SuperadminPlayerCandidate } from "@/types/view-models";
import styles from "./AdminRoomMembers.module.css";

const initialState: SuperadminUserActionState = {};

export function AddSuperadminRoomMember({ roomId }: { readonly roomId: string }) {
  const fieldId = useId();
  const [state, action, pending] = useActionState(addPortalUserToRoom, initialState);
  const [lookupPending, startLookup] = useTransition();
  const [email, setEmail] = useState("");
  const [candidate, setCandidate] = useState<SuperadminPlayerCandidate | null>(null);
  const [lookupMessage, setLookupMessage] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);

  function invalidateKey() {
    idempotencyKeyRef.current = null;
  }

  function lookup() {
    setCandidate(null);
    setLookupMessage("");
    invalidateKey();
    startLookup(() => {
      void lookupPortalUserByEmail(email).then((result) => {
        if (!result.ok) {
          setLookupMessage(result.message);
          return;
        }
        setCandidate(result.candidate);
        setLookupMessage(result.candidate ? "" : "No hay un jugador activo con ese correo.");
      });
    });
  }

  function prepareSubmission(event: FormEvent<HTMLFormElement>) {
    idempotencyKeyRef.current ??= globalThis.crypto.randomUUID();
    const keyField = event.currentTarget.elements.namedItem("idempotencyKey");
    if (keyField instanceof HTMLInputElement) keyField.value = idempotencyKeyRef.current;
  }

  const emailError = [
    ...new Set([lookupMessage, state.fieldErrors?.targetPlayerId].filter(Boolean)),
  ].join(" ");

  return (
    <form
      action={action}
      onSubmit={prepareSubmission}
      className={styles.addForm}
      aria-busy={pending}
    >
      <input type="hidden" name="roomId" value={roomId} readOnly />
      <input type="hidden" name="idempotencyKey" defaultValue="" />
      <input type="hidden" name="targetPlayerId" value={candidate?.playerId ?? ""} readOnly />
      <h3>Añadir usuario a la sala</h3>
      <p>Busca una cuenta existente por correo y elige su rol en esta sala.</p>
      <FormField
        id={fieldId + "-correo-electronico"}
        label="Correo electrónico"
        density="compact"
        required
        error={emailError}
        announceError
      >
        {(field) => (
          <div className={styles.addSearch}>
            <Input
              {...field}
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.currentTarget.value);
                setCandidate(null);
                setLookupMessage("");
                invalidateKey();
              }}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={lookup}
              loading={lookupPending}
              disabled={!email.trim()}
            >
              {lookupPending ? "Buscando…" : "Buscar usuario"}
            </Button>
          </div>
        )}
      </FormField>
      {candidate ? (
        <p className={styles.candidate}>
          ✓ {candidate.displayName} · {candidate.email}
        </p>
      ) : null}

      <FormField
        id={fieldId + "-role"}
        label="Rol de sala"
        density="compact"
        error={state.fieldErrors?.role}
        announceError
      >
        {(field) => (
          <Select {...field} name="role" defaultValue="member" onChange={invalidateKey}>
            <option value="member">Miembro</option>
            <option value="admin">Administrador</option>
            <option value="spectator">Espectador</option>
          </Select>
        )}
      </FormField>

      <FormField
        id={fieldId + "-reason"}
        label="Motivo de auditoría"
        error={state.fieldErrors?.reason}
        announceError
        density="compact"
        required
      >
        {(field) => (
          <Textarea
            {...field}
            name="reason"
            rows={2}
            maxLength={500}
            onChange={invalidateKey}
            placeholder="Incorporación a la beta"
          />
        )}
      </FormField>

      {state.message ? (
        <p
          className={state.ok ? styles.formSuccess : styles.formError}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="sm" loading={pending} disabled={!candidate}>
        {pending ? "Añadiendo…" : "Añadir a la sala"}
      </Button>
    </form>
  );
}
