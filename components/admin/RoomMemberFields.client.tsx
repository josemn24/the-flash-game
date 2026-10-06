"use client";

import { useId } from "react";
import type { SuperadminPlayerCandidate } from "@/types/view-models";
import { Button, FormField, Input, Select } from "@/components/ui";
import styles from "./CreateRoomForm.module.css";

export type RoomMemberRow = {
  readonly id: number;
  readonly email: string;
  readonly role: "admin" | "member" | "spectator";
  readonly candidate: SuperadminPlayerCandidate | null;
  readonly message: string;
};

export function RoomOwnerFields({
  email,
  candidate,
  message,
  error,
  pending,
  onEmailChange,
  onLookup,
}: {
  readonly email: string;
  readonly candidate: SuperadminPlayerCandidate | null;
  readonly message: string;
  readonly error?: string;
  readonly pending: boolean;
  readonly onEmailChange: (value: string) => void;
  readonly onLookup: () => void;
}) {
  const fieldId = useId();
  return (
    <fieldset className={styles.fieldset}>
      <legend>Propietario inicial</legend>
      <FormField
        id={fieldId + "-owner-email"}
        label="Correo del propietario"
        density="compact"
        required
        error={message || error}
      >
        {(field) => (
          <div className={styles.inlineField}>
            <Input
              {...field}
              name="ownerEmail"
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.currentTarget.value)}
              placeholder="owner@ejemplo.com"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onLookup}
              loading={pending}
            >
              Buscar
            </Button>
          </div>
        )}
      </FormField>
      {candidate ? <p className={styles.confirmed}>✓ {candidate.displayName}</p> : null}
    </fieldset>
  );
}

export function RoomMemberFields({
  members,
  error,
  pending,
  onAdd,
  onUpdate,
  onLookup,
  onRemove,
}: {
  readonly members: readonly RoomMemberRow[];
  readonly error?: string;
  readonly pending: boolean;
  readonly onAdd: () => void;
  readonly onUpdate: (id: number, patch: Partial<RoomMemberRow>) => void;
  readonly onLookup: (member: RoomMemberRow) => void;
  readonly onRemove: (id: number) => void;
}) {
  const fieldId = useId();
  return (
    <fieldset
      className={styles.fieldset}
      aria-labelledby={fieldId + "-group"}
      aria-describedby={error ? fieldId + "-group-error" : undefined}
    >
      <legend className={styles.legendRow}>
        <span id={fieldId + "-group"}>
          Grupo inicial <em>(opcional)</em>
        </span>
        <Button type="button" variant="secondary" size="sm" onClick={onAdd}>
          Añadir miembro
        </Button>
      </legend>
      {members.length === 0 ? (
        <p className={styles.helper}>Puedes crear la sala solo con su propietario.</p>
      ) : null}
      <div className={styles.memberList}>
        {members.map((member) => (
          <div className={styles.memberRow} key={member.id}>
            <input type="hidden" name="memberEmail" value={member.email} readOnly />
            <input type="hidden" name="memberRole" value={member.role} readOnly />
            <FormField
              id={fieldId + "-member-" + member.id + "-email"}
              label="Email del miembro"
              density="compact"
              required
              error={member.message}
            >
              {(field) => (
                <Input
                  {...field}
                  type="email"
                  value={member.email}
                  onChange={(event) =>
                    onUpdate(member.id, {
                      email: event.currentTarget.value,
                      candidate: null,
                      message: "",
                    })
                  }
                  placeholder="jugador@ejemplo.com"
                />
              )}
            </FormField>
            <FormField
              id={fieldId + "-member-" + member.id + "-role"}
              label="Rol del miembro"
              density="compact"
            >
              {(field) => (
                <Select
                  {...field}
                  value={member.role}
                  onChange={(event) =>
                    onUpdate(member.id, {
                      role: event.currentTarget.value as RoomMemberRow["role"],
                    })
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="spectator">Spectator</option>
                </Select>
              )}
            </FormField>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onLookup(member)}
              loading={pending}
            >
              Buscar
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => onRemove(member.id)}>
              Quitar
            </Button>
            {member.candidate ? (
              <span className={styles.confirmed}>✓ {member.candidate.displayName}</span>
            ) : null}
          </div>
        ))}
      </div>
      {error ? (
        <small id={fieldId + "-group-error"} className={styles.error}>
          {error}
        </small>
      ) : null}
    </fieldset>
  );
}
