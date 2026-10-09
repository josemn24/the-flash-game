"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Avatar, Button, CrossIcon, FormField, IconButton, Input } from "@/components/ui";
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();
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
      closeButtonRef.current?.focus({ preventScroll: true });
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

    const syncViewport = () => {
      dialog.style.setProperty("--profile-dialog-viewport-height", `${viewport.height}px`);
      dialog.style.setProperty("--profile-dialog-viewport-top", `${viewport.offsetTop}px`);
    };

    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);

    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
      dialog.style.removeProperty("--profile-dialog-viewport-height");
      dialog.style.removeProperty("--profile-dialog-viewport-top");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const { style } = document.body;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const properties = ["position", "top", "left", "width", "overflow"];
    const previousStyles = properties.map((property) => ({
      property,
      value: style.getPropertyValue(property),
      priority: style.getPropertyPriority(property),
    }));
    style.setProperty("position", "fixed");
    style.setProperty("top", `${-scrollY}px`);
    style.setProperty("left", `${-scrollX}px`);
    style.setProperty("width", "100%");
    style.setProperty("overflow", "hidden");

    return () => {
      for (const { property, value, priority } of previousStyles) {
        if (value) style.setProperty(property, value, priority);
        else style.removeProperty(property);
      }
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (previewSrc) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  function resetDraft() {
    setDraft(profile);
    setSelectedFile(null);
    setPreviewSrc(undefined);
    setErrors({});
    setIsSaving(false);
    submitGeneration.current += 1;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function closeDialog() {
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
    if (!file) return;
    setPreviewSrc(undefined);
    setSelectedFile(null);
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
      onClose={() => {
        resetDraft();
        onClose();
      }}
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
          <IconButton ref={closeButtonRef} onClick={closeDialog} label="Cerrar perfil">
            <CrossIcon />
          </IconButton>
          <h2 id={titleId}>Tu perfil</h2>
          <Button
            type="submit"
            form={formId}
            size="sm"
            loading={isSaving}
            aria-label={confirmationPending ? "Reintentar confirmación" : "Guardar cambios"}
          >
            {confirmationPending ? "Reintentar" : "Guardar"}
          </Button>
        </header>

        <form id={formId} className={styles.form} onSubmit={handleSubmit} aria-busy={isSaving}>
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
              announceError
              className={styles.avatarCopy}
            >
              {(field) => (
                <>
                  <input
                    ref={fileInputRef}
                    id={field.id}
                    aria-label="Imagen de perfil"
                    aria-invalid={field["aria-invalid"]}
                    aria-describedby={field["aria-describedby"]}
                    type="file"
                    hidden
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                    disabled={isSaving || confirmationPending}
                  />
                  <Button
                    id={`${avatarId}-button`}
                    variant="secondary"
                    size="sm"
                    aria-label="Cambiar foto"
                    aria-invalid={field["aria-invalid"]}
                    aria-describedby={field["aria-describedby"]}
                    className={styles.photoButton}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving || confirmationPending}
                  >
                    Cambiar foto
                  </Button>
                </>
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

          {confirmationPending ? (
            <p className={styles.confirmationStatus} role="status">
              No hemos podido confirmar la imagen
            </p>
          ) : null}
        </form>
      </div>
    </dialog>
  );
}
