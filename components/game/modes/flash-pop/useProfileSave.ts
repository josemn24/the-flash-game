"use client";

import { randomUuid } from "@/lib/randomUuid";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  abortProfileAvatar,
  confirmProfileAvatar,
  prepareProfileAvatar,
  updateProfileName,
} from "@/app/actions/profile";
import { uploadFile } from "@/lib/media/uploadFile";
import type { ProfileSaveResult } from "@/types/view-models/user-actions";
import type { UserProfile } from "@/types/view-models/user";

type PendingConfirmation = { accountId: string; assetId: string; idempotencyKey: string };
const uncertain: ProfileSaveResult = {
  ok: false,
  code: "confirmation_pending",
  message: "No hemos podido confirmar la imagen",
};
const unavailable: ProfileSaveResult = {
  ok: false,
  code: "unauthorized",
  message: "Tu sesión ha cambiado. Recarga el perfil.",
};

/** The original uploaded command survives closing the dialog, only in memory. */
export function useProfileSave(
  accountId: string,
  onNameSaved: (profile: UserProfile) => void,
  onSaved: (profile: UserProfile) => void,
) {
  const pending = useRef<PendingConfirmation | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const [state, setState] = useState({ accountId, saving: false, pending: false });
  useEffect(() => {
    generation.current += 1;
    pending.current = null;
    busy.current = false;
    return () => {
      generation.current += 1;
      pending.current = null;
      busy.current = false;
    };
  }, [accountId]);

  const save = useCallback(
    async ({ name, file }: { name: string; file: File | null }): Promise<ProfileSaveResult> => {
      if (busy.current) return uncertain;
      const ownGeneration = generation.current;
      const current = () => generation.current === ownGeneration;
      busy.current = true;
      setState({ accountId, saving: true, pending: Boolean(pending.current) });
      try {
        if (!pending.current) {
          const named = await updateProfileName(name);
          if (!current()) return unavailable;
          if (!named.ok) return named;
          onNameSaved(named.profile);
          if (!file) {
            onSaved(named.profile);
            return named;
          }
          const prepared = await prepareProfileAvatar({
            mimeType: file.type,
            byteSize: file.size,
            idempotencyKey: randomUuid(),
          });
          if (!current()) return unavailable;
          if (!prepared.ok) return prepared;
          const uploaded = await uploadFile(prepared.signedUploadUrl, file);
          if (!current()) return unavailable;
          if (!uploaded) {
            await abortProfileAvatar(prepared.assetId).catch(() => undefined);
            return {
              ok: false,
              code: "storage_unavailable",
              message: "No se ha podido subir la imagen. Inténtalo de nuevo.",
            };
          }
          pending.current = {
            accountId,
            assetId: prepared.assetId,
            idempotencyKey: prepared.confirmIdempotencyKey,
          };
          setState({ accountId, saving: true, pending: false });
        }
        const original = pending.current;
        if (!original || original.accountId !== accountId || !current()) return unavailable;
        let result: ProfileSaveResult;
        try {
          result = await confirmProfileAvatar({
            assetId: original.assetId,
            idempotencyKey: original.idempotencyKey,
          });
        } catch {
          result = uncertain;
        }
        if (!current()) return unavailable;
        if (result.ok) {
          pending.current = null;
          onSaved(result.profile);
        } else if (!["confirmation_pending", "storage_unavailable"].includes(result.code)) {
          pending.current = null;
        }
        return result;
      } catch {
        if (!current()) return unavailable;
        return pending.current
          ? uncertain
          : {
              ok: false,
              code: file ? "storage_unavailable" : "save_failed",
              message: "No se han podido guardar los cambios. Inténtalo de nuevo.",
            };
      } finally {
        if (current()) {
          busy.current = false;
          setState({ accountId, saving: false, pending: Boolean(pending.current) });
        }
      }
    },
    [accountId, onNameSaved, onSaved],
  );
  return {
    save,
    isSaving: state.accountId === accountId && state.saving,
    confirmationPending: state.accountId === accountId && state.pending,
  };
}
