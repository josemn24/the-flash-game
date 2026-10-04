import "server-only";

import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import type { AuthenticationGateway } from "@/application/ports/authentication";
import type { AuthenticationResult } from "@/types/contracts/authentication";
import { createClient } from "@/lib/supabase/server";

function authenticationFailure(error: unknown): AuthenticationResult {
  if (isAuthError(error)) {
    if (error.code === "invalid_credentials") return { ok: false, code: "credentials" };
    if (error.status === 429 || error.code === "over_request_rate_limit") {
      return { ok: false, code: "rate_limit" };
    }
    if (
      (error.status !== undefined && error.status >= 500 && error.status < 600) ||
      error.code === "request_timeout"
    ) {
      return { ok: false, code: "service" };
    }
    if (isAuthRetryableFetchError(error)) return { ok: false, code: "connection" };
  }
  return { ok: false, code: "unexpected" };
}

export const supabaseAuthentication: AuthenticationGateway = {
  async signIn(credentials) {
    try {
      const client = await createClient();
      const { error } = await client.auth.signInWithPassword(credentials);
      return error ? authenticationFailure(error) : { ok: true };
    } catch (error) {
      return authenticationFailure(error);
    }
  },

  async signOut() {
    try {
      const client = await createClient();
      const { error } = await client.auth.signOut();
      return error ? authenticationFailure(error) : { ok: true };
    } catch (error) {
      return authenticationFailure(error);
    }
  },
};
