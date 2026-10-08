"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Avatar, Button, CrossIcon, FormField, Input } from "@/components/ui";
import { validateProfileName } from "@/lib/userProfile";
import { validateAvatarSelection } from "@/lib/media/avatarValidation";
import type { UserProfile } from "@/types/view-models/user";
import type { ProfileSaveResult } from "@/types/view-models/user-actions";
import styles from "./FlashPopProfileDialog.module.css";

type FlashPopProfileDialogProps = {
  open: boolean;
  saving?: boolean;
  confirmationPending?: boolean;
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
  saving,
  confirmationPending = false,
}: FlashPopProfileDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const nameId = useId();
  const avatarId = useId();
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [locallySaving, setIsSaving] = useState(false);
  const isSaving = saving ?? locallySaving;
  const submitGeneration = useRef(0);
  useEffect(
    () => () => {
      submitGeneration.current += 1;
    },
    [profile.id, open],
  );
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

  useEffect(() => {
    const dialog = dialogRef.current;
    const viewport = window.visualViewport;

    if (!dialog || !open || !viewport) {
      return;
    }

    const syncViewportHeight = () => {
      dialog.style.setProperty("--profile-dialog-viewport-height", `${viewport.height}px`);
    };

    syncViewportHeight();
    viewport.addEventListener("resize", syncViewportHeight);
    viewport.addEventListener("scroll", syncViewportHeight);

    return () => {
      viewport.removeEventListener("resize", syncViewportHeight);
      viewport.removeEventListener("scroll", syncViewportHeight);
      dialog.style.removeProperty("--profile-dialog-viewport-height");
    };
  }, [open]);

  function closeDialog() {
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setDraft(profile);
    setSelectedFile(null);
    setPreviewSrc(undefined);
    setErrors({});
    setIsSaving(false);
    submitGeneration.current += 1;
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
    if (isSaving) return;
    const ownGeneration = submitGeneration.current;

    const nameError = validateProfileName(draft.name);
    if (nameError && !confirmationPending) {
      setErrors((current) => ({ ...current, name: nameError }));
      nameInputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      const result = await onSave({ name: draft.name.trim(), file: selectedFile });
      if (ownGeneration !== submitGeneration.current) return;
      if (!result.ok) {
        const isAvatarError =
          result.code === "invalid_file" ||
          result.code === "storage_unavailable" ||
          result.code === "conflict" ||
          result.code === "confirmation_pending" ||
          (result.code === "save_failed" && Boolean(selectedFile || confirmationPending));
        setErrors(isAvatarError ? { avatar: result.message } : { name: result.message });
      }
    } catch {
      if (ownGeneration === submitGeneration.current)
        setErrors({ avatar: "No se han podido confirmar los cambios. Inténtalo de nuevo." });
    } finally {
      if (ownGeneration === submitGeneration.current) setIsSaving(false);
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

        <form className={styles.form} onSubmit={handleSubmit} aria-busy={isSaving}>
          <div className={styles.avatarField}>
            <Avatar
              name={draft.name || profile.name}
              src={previewSrc ?? profile.avatarSrc}
              size="lg"
            />
            <FormField
              id={avatarId}
              label="Imagen de perfil"
              description="JPEG, PNG o WebP. Máximo 5 MB y 2048 px."
              error={confirmationPending ? undefined : errors.avatar}
              className={styles.avatarCopy}
            >
              {(field) => (
                <Input
                  {...field}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  disabled={isSaving || confirmationPending}
                />
              )}
            </FormField>
          </div>

          <FormField id={nameId} label="Nombre visible" required error={errors.name} announceError>
            {(field) => (
              <Input
                {...field}
                ref={nameInputRef}
                type="text"
                disabled={isSaving || confirmationPending}
                value={draft.name}
                minLength={2}
                maxLength={24}
                autoComplete="name"
                onChange={handleNameChange}
              />
            )}
          </FormField>

          {confirmationPending ? <p role="status">No hemos podido confirmar la imagen</p> : null}

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSaving}>
              {confirmationPending ? "Reintentar confirmación" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
