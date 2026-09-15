"use server";

import { updateCurrentPlayerName } from "@/server/profile";

export async function updateProfileName(name: string) {
  return updateCurrentPlayerName(name);
}
