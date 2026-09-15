"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Avatar, Button, CrossIcon } from "@/components/ui";
import { validateProfileName } from "@/lib/userProfile";
import type { UserProfile } from "@/types/user";
import type { ProfileSaveResult } from "@/types/view-models/user-actions";
import styles from "./FlashPopProfileDialog.module.css";

type FlashPopProfileDialogProps = {
  open: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSave: (name: string) => Promise<ProfileSaveResult>;
};

type ProfileErrors = {
  name?: string;
};

export function FlashPopProfileDialog({
  open,
  profile,
  onClose,
  onSave,
}: FlashPopProfileDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const nameId = useId();
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      nameInputRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  function closeDialog() {
    setDraft(profile);
    setErrors({});
    dialogRef.current?.close();
  }

  function handleNameChange(event: ChangeEvent<HTMLInputElement>) {
    const name = event.currentTarget.value;
    setDraft((current) => ({ ...current, name }));

    if (errors.name && !validateProfileName(name)) {
      setErrors((current) => ({ ...current, name: undefined }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nameError = validateProfileName(draft.name);
    if (nameError) {
      setErrors((current) => ({ ...current, name: nameError }));
      nameInputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      const result = await onSave(draft.name.trim());
      if (!result.ok) setErrors({ name: result.message });
    } catch {
      setErrors({ name: "No se ha podido guardar el nombre. Inténtalo de nuevo." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      id="flash-pop-profile-dialog"
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
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
      <div className={styles.dialogSurface}>
        <header className={styles.dialogHeader}>
          <div>
            <span className={styles.dialogEyebrow}>Tu identidad</span>
            <h2 id={titleId}>Tu perfil</h2>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            onClick={closeDialog}
            aria-label="Cerrar perfil"
          >
            <CrossIcon />
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.avatarField}>
            <Avatar name={draft.name || profile.name} src={profile.avatarSrc} size="lg" />
            <div className={styles.avatarCopy}>
              <strong>Avatar pendiente</strong>
              <span>La imagen de perfil se integrará con Storage en S13.</span>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor={nameId}>Nombre visible</label>
            <input
              ref={nameInputRef}
              id={nameId}
              type="text"
              value={draft.name}
              required
              minLength={2}
              maxLength={24}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${nameId}-error` : undefined}
              onChange={handleNameChange}
            />
            {errors.name ? (
              <span id={`${nameId}-error`} className={styles.error} role="alert">
                {errors.name}
              </span>
            ) : null}
          </div>

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSaving}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
