import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "../config";
import type { Database } from "../database.types";
import { AuthAvailability, isInvalidSession } from "./auth-availability";

export function createSessionClient(cookies: CookieMethodsServer, availability: AuthAvailability) {
  const client = createServerClient<Database>(getSupabaseUrl(), getSupabasePublishableKey(), {
    global: { fetch: availability.fetch },
    cookies: {
      getAll: cookies.getAll,
      setAll: (values, headers) => {
        if (!availability.failure) return cookies.setAll?.(values, headers);
      },
    },
  });

  // Keep the SDK's public types and behavior, but bound every session operation,
  // including getSession calls made internally by getClaims/getUser/signOut.
  for (const method of [
    "getSession",
    "getClaims",
    "getUser",
    "signInWithPassword",
    "signOut",
  ] as const) {
    const original = client.auth[method].bind(client.auth);
    Object.defineProperty(client.auth, method, {
      configurable: true,
      value: (...args: Parameters<typeof original>) =>
        availability.run(async () => {
          const result = await Reflect.apply(original, undefined, args);
          if (
            (method === "getUser" || method === "getClaims") &&
            result.error &&
            !isInvalidSession(result.error)
          ) {
            throw availability.fail("service", result.error);
          }
          return result;
        }),
    });
  }
  return client;
}
