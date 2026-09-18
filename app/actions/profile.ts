"use server";

import {
  confirmCurrentPlayerAvatar,
  abortCurrentPlayerAvatar,
  prepareCurrentPlayerAvatar,
  updateCurrentPlayerName,
} from "@/server/profile";

export async function updateProfileName(name: string) {
  return updateCurrentPlayerName(name);
}

export async function prepareProfileAvatar(input: {
  mimeType: string;
  byteSize: number;
  idempotencyKey: string;
}) {
  return prepareCurrentPlayerAvatar(input);
}

export async function confirmProfileAvatar(input: { assetId: string; idempotencyKey: string }) {
  return confirmCurrentPlayerAvatar(input);
}

export async function abortProfileAvatar(assetId: string) {
  await abortCurrentPlayerAvatar(assetId);
}
