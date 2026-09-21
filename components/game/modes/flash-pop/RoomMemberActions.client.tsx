"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { manageRoomMember, type RoomMemberActionState } from "@/app/actions/room-members";
import { IconButton, MoreIcon, UserMinusIcon } from "@/components/ui";
import type { RoomMembershipRole } from "@/types/view-models";
import styles from "./FlashPopRoomSettings.module.css";

const initialState: RoomMemberActionState = {};

type RoomMemberActionsProps = {
  roomKey: string;
  targetMemberKey: string;
  targetName: string;
  role: RoomMembershipRole;
};

export function RoomMemberActions({
  roomKey,
  targetMemberKey,
  targetName,
  role,
}: RoomMemberActionsProps) {
  const [state, formAction, pending] = useActionState(manageRoomMember, initialState);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function confirmRemoval(event: FormEvent<HTMLFormElement>) {
    if (!globalThis.confirm(`¿Expulsar a ${targetName} de la sala?`)) event.preventDefault();
  }

  function actionForm(
    action: "grant_admin" | "revoke_admin" | "remove",
    children: ReactNode,
    onSubmit?: (event: FormEvent<HTMLFormElement>) => void,
  ) {
    return (
      <form
        action={formAction}
        onSubmit={(event) => {
          onSubmit?.(event);
          if (event.defaultPrevented) return;
          const idempotencyInput = event.currentTarget.elements.namedItem("idempotencyKey");
          if (idempotencyInput instanceof HTMLInputElement) {
            idempotencyInput.value = globalThis.crypto.randomUUID();
          }
          setOpen(false);
        }}
      >
        <input type="hidden" name="roomKey" value={roomKey} />
        <input type="hidden" name="targetMemberKey" value={targetMemberKey} />
        <input type="hidden" name="idempotencyKey" value="" />
        <button
          type="submit"
          name="action"
          value={action}
          disabled={pending}
          className={styles.memberActionItem}
        >
          {children}
        </button>
      </form>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.memberActions} ${open ? styles.memberActionsOpen : ""}`}
    >
      <IconButton
        label={`Acciones para ${targetName}`}
        className={styles.memberActionsTrigger}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreIcon />
      </IconButton>
      {open ? (
        <div
          className={styles.memberActionMenu}
          role="menu"
          aria-label={`Gestionar a ${targetName}`}
        >
          {role === "admin"
            ? actionForm("revoke_admin", "Quitar permisos de administrador")
            : role === "member"
              ? actionForm("grant_admin", "Dar permisos de administrador")
              : null}
          {actionForm(
            "remove",
            <span className={styles.dangerAction}>
              <UserMinusIcon />
              Expulsar de la sala
            </span>,
            confirmRemoval,
          )}
        </div>
      ) : null}
      {state.message ? (
        <p className={styles.memberActionError} role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
