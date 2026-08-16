"use client";

import { useEffect, useId, useRef } from "react";
import { CrossIcon, NotebookIcon } from "@/components/icons";
import styles from "@/components/NarrativeGame.module.css";
import type { NarrativeNotebookEntry } from "@/types/game";

export function FieldNotebook({
  open,
  entries,
  onClose,
}: {
  open: boolean;
  entries: NarrativeNotebookEntry[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.notebookDialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        dialogRef.current?.close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className={styles.notebookSurface}>
        <header className={styles.notebookHeader}>
          <div>
            <span>Pruebas de la trayectoria</span>
            <h2 id={titleId}>Registro de evidencias</h2>
          </div>
          <button
            type="button"
            className={styles.notebookClose}
            onClick={() => dialogRef.current?.close()}
            aria-label="Cerrar cuaderno"
          >
            <CrossIcon className="h-5 w-5" />
          </button>
        </header>

        {entries.length === 0 ? (
          <div className={styles.notebookEmpty}>
            <NotebookIcon className="h-9 w-9" />
            <strong>El registro todavía está en blanco</strong>
            <p>Las evidencias aparecerán aquí a medida que avance el relato.</p>
          </div>
        ) : (
          <ol className={styles.notebookEntries}>
            {entries.map((entry, index) => (
              <li key={entry.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  {entry.relevance === "potential" && <small>Puede estar relacionado</small>}
                  <p>{entry.text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </dialog>
  );
}
