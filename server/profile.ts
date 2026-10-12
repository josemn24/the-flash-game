import "server-only";

import { revalidatePath } from "next/cache";
import { ApplicationProfileUseCases } from "@/application/use-cases/profile";
import type {
  AvatarUploadConfirmationResult,
  AvatarUploadPreparationResult,
} from "@/application/ports/profile-use-cases";
import {
  getProvisionedCurrentPlayer,
  supabaseCurrentViewerReaderFor,
} from "@/infrastructure/supabase/identity/currentViewer";
import { supabaseProfileCommandsFor } from "@/infrastructure/supabase/identity/profileCommands";
import { supabaseMediaAssetCommandsFor } from "@/infrastructure/supabase/assets/mediaAssetCommands";
import { supabaseMediaStorage } from "@/infrastructure/supabase/assets/mediaStorage";
import type { ProfileSaveResult } from "@/types/view-models/user-actions";
import type { PlayerId } from "@/types/domain/identifiers";
import { logHttpEvent } from "@/server/observability";
import { randomUUID } from "node:crypto";

export type { AvatarUploadConfirmationResult, AvatarUploadPreparationResult };

async function createProfileUseCases() {
  const current = await getProvisionedCurrentPlayer();
  if (!current) return null;
  return new ApplicationProfileUseCases({
    onAvatarEvent: (event, assetId) =>
      logHttpEvent({
        requestId: randomUUID(),
        route: "profile/avatar",
        operation: event,
        status: event === "confirmation_recovered" ? 200 : 503,
        assetId,
      }),
    actor: { authUserId: current.authUserId, playerId: current.row.player_id as PlayerId },
    currentViewer: supabaseCurrentViewerReaderFor(current),
    profileCommands: supabaseProfileCommandsFor(current),
    mediaAssetCommands: supabaseMediaAssetCommandsFor(current.authUserId),
    mediaStorage: supabaseMediaStorage,
  });
}

export async function getCurrentViewerProfile() {
  const useCases = await createProfileUseCases();
  return useCases?.getCurrentViewer() ?? null;
}

export async function updateCurrentPlayerName(name: string): Promise<ProfileSaveResult> {
  const useCases = await createProfileUseCases();
  if (!useCases) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
    };
  }
  const result = await useCases.updateName(name);
  if (result.ok) revalidateProfile();
  return result;
}

export async function prepareCurrentPlayerAvatar(input: {
  mimeType: string;
  byteSize: number;
  idempotencyKey: string;
}): Promise<AvatarUploadPreparationResult> {
  const useCases = await createProfileUseCases();
  if (!useCases) return { ok: false, code: "unauthorized", message: "Tu sesión ha caducado." };
  return useCases.prepareAvatar(input);
}

export async function confirmCurrentPlayerAvatar(input: {
  assetId: string;
  idempotencyKey: string;
}): Promise<AvatarUploadConfirmationResult> {
  const useCases = await createProfileUseCases();
  if (!useCases) return { ok: false, code: "unauthorized", message: "Tu sesión ha caducado." };
  const result = await useCases.confirmAvatar(input);
  if (result.ok) revalidateProfile();
  return result;
}

export async function abortCurrentPlayerAvatar(assetId: string) {
  const useCases = await createProfileUseCases();
  if (useCases) await useCases.abortAvatar(assetId);
}

function revalidateProfile() {
  try {
    revalidatePath("/");
  } catch {
    logHttpEvent({
      requestId: randomUUID(),
      route: "profile",
      operation: "revalidation_failed",
      status: 503,
    });
  }
}
