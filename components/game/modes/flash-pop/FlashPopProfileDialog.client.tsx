"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Avatar, Button, CrossIcon } from "@/components/ui";
import { validateProfileImage, validateProfileName } from "@/lib/userProfile";
import type { UserProfile } from "@/types/user";
import styles from "./FlashPopProfileDialog.module.css";

type FlashPopProfileDialogProps = {
  open: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
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
  const avatarId = useId();
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [errors, setErrors] = useState<ProfileErrors>({});

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

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    const imageError = validateProfileImage(file);
    if (imageError === "type") {
      setErrors((current) => ({
        ...current,
        avatar: "Selecciona una imagen válida.",
      }));
      event.currentTarget.value = "";
      return;
    }

    if (imageError === "size") {
      setErrors((current) => ({
        ...current,
        avatar: "La imagen no puede superar los 5 MB.",
      }));
      event.currentTarget.value = "";
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        setErrors((current) => ({
          ...current,
          avatar: "No se ha podido cargar la imagen.",
        }));
        return;
      }

      setDraft((current) => ({ ...current, avatarSrc: reader.result as string }));
      setErrors((current) => ({ ...current, avatar: undefined }));
    });
    reader.addEventListener("error", () => {
      setErrors((current) => ({
        ...current,
        avatar: "No se ha podido cargar la imagen.",
      }));
    });
    reader.readAsDataURL(file);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nameError = validateProfileName(draft.name);
    if (nameError) {
      setErrors((current) => ({ ...current, name: nameError }));
      nameInputRef.current?.focus();
      return;
    }

    onSave({
      ...draft,
      name: draft.name.trim(),
    });
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
            <Avatar name={draft.name || profile.name} src={draft.avatarSrc} size="lg" />
            <div className={styles.avatarCopy}>
              <label className={styles.fileButton} htmlFor={avatarId}>
                Cambiar imagen
              </label>
              <input
                id={avatarId}
                className={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                aria-describedby={errors.avatar ? `${avatarId}-error` : undefined}
              />
              <span>JPG, PNG o GIF · máximo 5 MB</span>
              {errors.avatar ? (
                <span id={`${avatarId}-error`} className={styles.error} role="alert">
                  {errors.avatar}
                </span>
              ) : null}
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
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
