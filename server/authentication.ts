import "server-only";

import { ApplicationAuthenticationUseCases } from "@/application/use-cases/authentication";
import { supabaseAuthentication } from "@/infrastructure/supabase/identity/authentication";

export async function signInWithCredentials(input: unknown) {
  return new ApplicationAuthenticationUseCases(supabaseAuthentication).signIn(input);
}

export async function signOutCurrentSession() {
  return new ApplicationAuthenticationUseCases(supabaseAuthentication).signOut();
}
