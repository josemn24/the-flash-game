"use client";

import { randomUuid } from "@/lib/randomUuid";

import {
  useId,
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";

import { Button, FormField, Input, Textarea, CrossIcon } from "@/components/ui";

import {
  createPrivateRoom,
  lookupSuperadminPlayers,
  type CreateRoomActionState,
} from "@/app/admin/actions";

import type { SuperadminPlayerCandidate } from "@/types/view-models";

import { RoomMemberFields, RoomOwnerFields, type RoomMemberRow } from "./RoomMemberFields.client";
import styles from "./CreateRoomForm.module.css";

const initialState: CreateRoomActionState = {};
const timeZoneOptions = ["Europe/Madrid", "UTC", "Europe/London", "America/New_York"];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function candidateFor(candidates: readonly SuperadminPlayerCandidate[], email: string) {
  return candidates.find((candidate) => candidate.email === normalizeEmail(email)) ?? null;
}

function CreateRoomDialogForm({ onCancel }: { readonly onCancel: () => void }) {
  const fieldId = useId();
  const [state, action, pending] = useActionState(createPrivateRoom, initialState);
  const [lookupPending, startLookup] = useTransition();
  const idempotencyKeyRef = useRef<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerCandidate, setOwnerCandidate] = useState<SuperadminPlayerCandidate | null>(null);
  const [ownerMessage, setOwnerMessage] = useState("");
  const [members, setMembers] = useState<RoomMemberRow[]>([]);
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
      {
        id: nextMemberId,
        email: "",
        role: "member",
        candidate: null,
        message: "",
      } satisfies RoomMemberRow,
    ]);
    setNextMemberId((current) => current + 1);
  }

  function updateMember(id: number, patch: Partial<RoomMemberRow>) {
    setMembers((current) =>
      current.map((member) => (member.id === id ? { ...member, ...patch } : member)),
    );
  }

  function findMember(member: RoomMemberRow) {
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
      idempotencyKeyRef.current = randomUuid();
    }
    const field = event.currentTarget.elements.namedItem("idempotencyKey");
    if (field instanceof HTMLInputElement) {
      field.value = idempotencyKeyRef.current;
    }
  }

  return (
    <form action={action} className={styles.form} onSubmit={setIdempotencyKey} aria-busy={pending}>
      <input type="hidden" name="idempotencyKey" defaultValue="" />

      <div className={styles.grid}>
        <FormField
          id={fieldId + "-title"}
          label="Título"
          density="compact"
          required
          error={state.fieldErrors?.title}
        >
          {(field) => (
            <Input
              {...field}
              name="title"
              minLength={3}
              maxLength={80}
              placeholder="Liga de primavera"
              data-dialog-autofocus
            />
          )}
        </FormField>

        <FormField
          id={fieldId + "-timeZone"}
          label="Zona horaria"
          density="compact"
          required
          error={state.fieldErrors?.timeZone}
        >
          {(field) => (
            <>
              <Input
                {...field}
                name="timeZone"
                list={fieldId + "-time-zones"}
                defaultValue="Europe/Madrid"
                placeholder="Europe/Madrid"
              />
              <datalist id={fieldId + "-time-zones"}>
                {timeZoneOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </>
          )}
        </FormField>
      </div>

      <FormField
        id={fieldId + "-description"}
        label={
          <>
            Descripción <em>(opcional)</em>
          </>
        }
        density="compact"
        error={state.fieldErrors?.description}
      >
        {(field) => (
          <Textarea
            {...field}
            name="description"
            maxLength={280}
            rows={3}
            placeholder="Contexto de la sala"
          />
        )}
      </FormField>

      <RoomOwnerFields
        email={ownerEmail}
        candidate={ownerCandidate}
        message={ownerMessage}
        error={state.fieldErrors?.ownerEmail}
        pending={lookupPending}
        onEmailChange={(value) => {
          setOwnerEmail(value);
          setOwnerCandidate(null);
          setOwnerMessage("");
        }}
        onLookup={findOwner}
      />
      <RoomMemberFields
        members={members}
        error={state.fieldErrors?.members}
        pending={lookupPending}
        onAdd={addMember}
        onUpdate={updateMember}
        onLookup={findMember}
        onRemove={(id) => setMembers((current) => current.filter((item) => item.id !== id))}
      />

      <FormField
        id={fieldId + "-reason"}
        label="Motivo de auditoría"
        density="compact"
        required
        error={state.fieldErrors?.reason}
      >
        {(field) => (
          <Textarea
            {...field}
            name="reason"
            maxLength={500}
            rows={2}
            placeholder="Preparación de la beta cerrada"
          />
        )}
      </FormField>

      {state.message ? (
        <p className={styles.formMessage} role="alert">
          {state.message}
        </p>
      ) : null}
      <div className={styles.submitRow}>
        <div className={styles.dialogActions}>
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={!canSubmit} loading={pending}>
            {pending ? "Creando…" : "Crear sala"}
          </Button>
        </div>
        {!ownerCandidate || hasUnresolvedMember ? (
          <small className={styles.helper}>Busca el owner y cada miembro antes de confirmar.</small>
        ) : null}
      </div>
    </form>
  );
}

export function CreateRoomForm() {
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

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        <span className={styles.triggerIcon} aria-hidden="true">
          +
        </span>
        <span>Crear nueva sala privada</span>
      </button>

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
                <p className={styles.eyebrow}>Nueva operación</p>
                <h2 id={titleId}>Crear una sala privada</h2>
                <p id={descriptionId} className={styles.dialogDescription}>
                  La sala quedará activa y lista para preparar su primera temporada.
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
            <CreateRoomDialogForm onCancel={closeDialog} />
          </div>
        ) : null}
      </dialog>
    </>
  );
}
