"use client";

import { useActionState, useId, useRef } from "react";
import { deleteSuperadminAttempt } from "@/app/admin/attempt-actions";
import { Button } from "@/components/ui";
import styles from "./CalendarManagement.module.css";

export function AdminAttemptDelete({
  roomId,
  publicationId,
  attemptId,
  playerName,
  roomTitle,
  challengeTitle,
}: {
  readonly roomId: string;
  readonly publicationId: string;
  readonly attemptId: string;
  readonly playerName: string;
  readonly roomTitle: string;
  readonly challengeTitle: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const description = useId();
  const [state, action, pending] = useActionState(deleteSuperadminAttempt, {});

  return (
    <>
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            dialog.current?.showModal();
            dialog.current?.querySelector<HTMLButtonElement>("[data-cancel]")?.focus();
          }}
        >
          Eliminar intento
        </Button>
      </div>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={title}
        aria-describedby={description}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <div className={styles.dialogSurface}>
          <h2 id={title}>Eliminar intento</h2>
          <p id={description}>
            Se eliminarán de forma irreversible la partida y los puntos de {playerName} en «
            {challengeTitle}», en la sala «{roomTitle}».
          </p>
          <form action={action}>
            <input type="hidden" name="roomId" value={roomId} />
            <input type="hidden" name="scheduledChallengeId" value={publicationId} />
            <input type="hidden" name="attemptId" value={attemptId} />
            {state.message ? <p role="alert">{state.message}</p> : null}
            <div className={styles.formActions}>
              <Button
                data-cancel
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => dialog.current?.close()}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={pending} disabled={pending}>
                Eliminar definitivamente
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
