"use server";

import { signInWithCredentials, signOutCurrentSession } from "@/server/authentication";
import type { AuthenticationResult, SignInCredentials } from "@/types/contracts/authentication";

export async function signIn(credentials: SignInCredentials): Promise<AuthenticationResult> {
  return signInWithCredentials(credentials);
}

export async function signOut(): Promise<AuthenticationResult> {
  return signOutCurrentSession();
}
