"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Avatar, Button, CrossIcon } from "@/components/ui";
import { validateProfileName } from "@/lib/userProfile";
import { validateAvatarSelection } from "@/lib/media/avatarValidation";
import type { UserProfile } from "@/types/user";
import type { ProfileSaveResult } from "@/types/view-models/user-actions";
import styles from "./FlashPopProfileDialog.module.css";

type FlashPopProfileDialogProps = {
  open: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSave: (input: { name: string; file: File | null }) => Promise<ProfileSaveResult>;
};

type ProfileErrors = {
  name?: string;
  avatar?: string;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string>();

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
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setDraft(profile);
    setSelectedFile(null);
    setPreviewSrc(undefined);
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

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setPreviewSrc(undefined);
    setSelectedFile(null);
    if (!file) return;
    const validationError = validateAvatarSelection(file);
    if (validationError) {
      setErrors((current) => ({ ...current, avatar: "Elige un JPEG, PNG o WebP de hasta 5 MB." }));
      return;
    }
    setErrors((current) => ({ ...current, avatar: undefined }));
    setSelectedFile(file);
    setPreviewSrc(URL.createObjectURL(file));
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
      const result = await onSave({ name: draft.name.trim(), file: selectedFile });
      if (!result.ok) {
        const isAvatarError =
          result.code === "invalid_file" || result.code === "storage_unavailable" || result.code === "conflict";
        setErrors(isAvatarError ? { avatar: result.message } : { name: result.message });
      }
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
            <Avatar name={draft.name || profile.name} src={previewSrc ?? profile.avatarSrc} size="lg" />
            <div className={styles.avatarCopy}>
              <label htmlFor="profile-avatar">Imagen de perfil</label>
              <span>JPEG, PNG o WebP. Máximo 5 MB y 2048 px.</span>
              <input
                id="profile-avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                disabled={isSaving}
                aria-invalid={Boolean(errors.avatar)}
              />
              {errors.avatar ? <span className={styles.error}>{errors.avatar}</span> : null}
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
