"use client";

import { useActionState, useRef, useState, useTransition, type FormEvent } from "react";
import {
  addPortalUserToRoom,
  lookupPortalUserByEmail,
  type SuperadminUserActionState,
} from "@/app/admin/user-actions";
import type { SuperadminPlayerCandidate } from "@/types/view-models";
import styles from "./AdminRoomMembers.module.css";

const initialState: SuperadminUserActionState = {};

export function AddSuperadminRoomMember({ roomId }: { readonly roomId: string }) {
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

  return (
    <form action={action} onSubmit={prepareSubmission} className={styles.addForm}>
      <input type="hidden" name="roomId" value={roomId} readOnly />
      <input type="hidden" name="idempotencyKey" defaultValue="" />
      <input type="hidden" name="targetPlayerId" value={candidate?.playerId ?? ""} readOnly />
      <h3>Añadir usuario a la sala</h3>
      <p>Busca una cuenta existente por correo y elige su rol en esta sala.</p>
      <div className={styles.addSearch}>
        <label>
          <span>Correo electrónico</span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.currentTarget.value);
              setCandidate(null);
              setLookupMessage("");
              invalidateKey();
            }}
            autoComplete="off"
            required
          />
        </label>
        <button type="button" onClick={lookup} disabled={lookupPending || !email.trim()}>
          {lookupPending ? "Buscando…" : "Buscar usuario"}
        </button>
      </div>
      {candidate ? (
        <p className={styles.candidate}>
          ✓ {candidate.displayName} · {candidate.email}
        </p>
      ) : null}
      {lookupMessage ? (
        <p className={styles.formError} role="alert">
          {lookupMessage}
        </p>
      ) : null}
      {state.fieldErrors?.targetPlayerId ? (
        <p className={styles.formError} role="alert">
          {state.fieldErrors.targetPlayerId}
        </p>
      ) : null}
      <label className={styles.addField}>
        <span>Rol de sala</span>
        <select name="role" defaultValue="member" onChange={invalidateKey}>
          <option value="member">Miembro</option>
          <option value="admin">Administrador</option>
          <option value="spectator">Espectador</option>
        </select>
      </label>
      {state.fieldErrors?.role ? (
        <p className={styles.formError} role="alert">
          {state.fieldErrors.role}
        </p>
      ) : null}
      <label className={styles.addField}>
        <span>Motivo de auditoría</span>
        <textarea
          name="reason"
          rows={2}
          maxLength={500}
          required
          onChange={invalidateKey}
          placeholder="Incorporación a la beta"
        />
      </label>
      {state.fieldErrors?.reason ? (
        <p className={styles.formError} role="alert">
          {state.fieldErrors.reason}
        </p>
      ) : null}
      {state.message ? (
        <p
          className={state.ok ? styles.formSuccess : styles.formError}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={!candidate || pending}>
        {pending ? "Añadiendo…" : "Añadir a la sala"}
      </button>
    </form>
  );
}
