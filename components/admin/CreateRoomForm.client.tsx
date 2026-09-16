"use client";

import { useActionState, useRef, useState, useTransition, type FormEvent } from "react";
import { createPrivateRoom, lookupSuperadminPlayers, type CreateRoomActionState } from "@/app/admin/actions";
import type { SuperadminPlayerCandidate } from "@/types/view-models";
import { Button, Card } from "@/components/ui";
import styles from "./CreateRoomForm.module.css";

type MemberRow = {
  readonly id: number;
  readonly email: string;
  readonly role: "admin" | "member" | "spectator";
  readonly candidate: SuperadminPlayerCandidate | null;
  readonly message: string;
};

const initialState: CreateRoomActionState = {};
const timeZoneOptions = ["Europe/Madrid", "UTC", "Europe/London", "America/New_York"];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function candidateFor(candidates: readonly SuperadminPlayerCandidate[], email: string) {
  return candidates.find((candidate) => candidate.email === normalizeEmail(email)) ?? null;
}

export function CreateRoomForm() {
  const [state, action, pending] = useActionState(createPrivateRoom, initialState);
  const [lookupPending, startLookup] = useTransition();
  const idempotencyKeyRef = useRef<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerCandidate, setOwnerCandidate] = useState<SuperadminPlayerCandidate | null>(null);
  const [ownerMessage, setOwnerMessage] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [nextMemberId, setNextMemberId] = useState(1);

  function findOwner() {
    setOwnerMessage("");
    setOwnerCandidate(null);
    startLookup(() => {
      void lookupSuperadminPlayers([ownerEmail]).then((result) => {
        if (!result.ok) {
          setOwnerMessage(result.message);
          return;
        }
        const candidate = candidateFor(result.candidates, ownerEmail);
        setOwnerCandidate(candidate);
        setOwnerMessage(candidate ? "" : "No hay un jugador activo con ese email.");
      });
    });
  }

  function addMember() {
    setMembers((current) => [
      ...current,
      { id: nextMemberId, email: "", role: "member", candidate: null, message: "" },
    ]);
    setNextMemberId((current) => current + 1);
  }

  function updateMember(id: number, patch: Partial<MemberRow>) {
    setMembers((current) => current.map((member) => (member.id === id ? { ...member, ...patch } : member)));
  }

  function findMember(member: MemberRow) {
    updateMember(member.id, { candidate: null, message: "" });
    startLookup(() => {
      void lookupSuperadminPlayers([member.email]).then((result) => {
        if (!result.ok) {
          updateMember(member.id, { message: result.message });
          return;
        }
        const candidate = candidateFor(result.candidates, member.email);
        updateMember(member.id, {
          candidate,
          message: candidate ? "" : "No hay un jugador activo con ese email.",
        });
      });
    });
  }

  const hasUnresolvedMember = members.some((member) => !member.candidate);
  const canSubmit = Boolean(ownerCandidate && !hasUnresolvedMember);

  function setIdempotencyKey(event: FormEvent<HTMLFormElement>) {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = globalThis.crypto.randomUUID();
    }
    const field = event.currentTarget.elements.namedItem("idempotencyKey");
    if (field instanceof HTMLInputElement) {
      field.value = idempotencyKeyRef.current;
    }
  }

  return (
    <Card as="section" className={styles.card} elevation="card" aria-labelledby="create-room-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Nueva operación</p>
          <h2 id="create-room-title">Crear una sala privada</h2>
        </div>
        <p className={styles.helper}>La sala quedará activa y lista para preparar su primera temporada.</p>
      </div>

      <form action={action} className={styles.form} onSubmit={setIdempotencyKey}>
        <input type="hidden" name="idempotencyKey" defaultValue="" />

        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Título</span>
            <input name="title" minLength={3} maxLength={80} required placeholder="Liga de primavera" />
            {state.fieldErrors?.title ? <small className={styles.error}>{state.fieldErrors.title}</small> : null}
          </label>

          <label className={styles.field}>
            <span>Zona horaria</span>
            <input
              name="timeZone"
              list="room-time-zones"
              defaultValue="Europe/Madrid"
              required
              placeholder="Europe/Madrid"
            />
            <datalist id="room-time-zones">
              {timeZoneOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
            {state.fieldErrors?.timeZone ? <small className={styles.error}>{state.fieldErrors.timeZone}</small> : null}
          </label>
        </div>

        <label className={styles.field}>
          <span>Descripción <em>(opcional)</em></span>
          <textarea name="description" maxLength={280} rows={3} placeholder="Contexto de la sala" />
          {state.fieldErrors?.description ? <small className={styles.error}>{state.fieldErrors.description}</small> : null}
        </label>

        <fieldset className={styles.fieldset}>
          <legend>Propietario inicial</legend>
          <div className={styles.inlineField}>
            <input
              name="ownerEmail"
              type="email"
              value={ownerEmail}
              onChange={(event) => {
                setOwnerEmail(event.currentTarget.value);
                setOwnerCandidate(null);
                setOwnerMessage("");
              }}
              placeholder="owner@ejemplo.com"
              required
              aria-invalid={Boolean(state.fieldErrors?.ownerEmail || ownerMessage)}
            />
            <Button type="button" variant="secondary" size="sm" onClick={findOwner} loading={lookupPending}>
              Buscar
            </Button>
          </div>
          {ownerCandidate ? <p className={styles.confirmed}>✓ {ownerCandidate.displayName}</p> : null}
          {ownerMessage || state.fieldErrors?.ownerEmail ? (
            <small className={styles.error}>{ownerMessage || state.fieldErrors?.ownerEmail}</small>
          ) : null}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <div className={styles.legendRow}>
            <legend>Grupo inicial <em>(opcional)</em></legend>
            <Button type="button" variant="secondary" size="sm" onClick={addMember}>Añadir miembro</Button>
          </div>
          {members.length === 0 ? <p className={styles.helper}>Puedes crear la sala solo con su propietario.</p> : null}
          <div className={styles.memberList}>
            {members.map((member) => (
              <div className={styles.memberRow} key={member.id}>
                <input type="hidden" name="memberEmail" value={member.email} readOnly />
                <input type="hidden" name="memberRole" value={member.role} readOnly />
                <input
                  type="email"
                  value={member.email}
                  onChange={(event) => updateMember(member.id, { email: event.currentTarget.value, candidate: null, message: "" })}
                  placeholder="jugador@ejemplo.com"
                  required
                  aria-label="Email del miembro"
                />
                <select
                  value={member.role}
                  onChange={(event) => updateMember(member.id, { role: event.currentTarget.value as MemberRow["role"] })}
                  aria-label="Rol del miembro"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="spectator">Spectator</option>
                </select>
                <Button type="button" variant="secondary" size="sm" onClick={() => findMember(member)} loading={lookupPending}>
                  Buscar
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setMembers((current) => current.filter((item) => item.id !== member.id))}>
                  Quitar
                </Button>
                {member.candidate ? <span className={styles.confirmed}>✓ {member.candidate.displayName}</span> : null}
                {member.message ? <small className={styles.error}>{member.message}</small> : null}
              </div>
            ))}
          </div>
          {state.fieldErrors?.members ? <small className={styles.error}>{state.fieldErrors.members}</small> : null}
        </fieldset>

        <label className={styles.field}>
          <span>Motivo de auditoría</span>
          <textarea name="reason" maxLength={500} rows={2} required placeholder="Preparación de la beta cerrada" />
          {state.fieldErrors?.reason ? <small className={styles.error}>{state.fieldErrors.reason}</small> : null}
        </label>

        {state.message ? <p className={styles.formMessage} role="alert">{state.message}</p> : null}
        <div className={styles.submitRow}>
          <Button type="submit" loading={pending} disabled={!canSubmit}>
            Crear sala
          </Button>
          {!ownerCandidate || hasUnresolvedMember ? <small className={styles.helper}>Busca el owner y cada miembro antes de confirmar.</small> : null}
        </div>
      </form>
    </Card>
  );
}
