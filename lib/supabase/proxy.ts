import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "./session-client";
import {
  AUTH_DEADLINE_HEADER,
  AUTH_FAILURE_HEADER,
  AuthAvailability,
  AuthServiceUnavailableError,
} from "./auth-availability";
import { logHttpEvent, requestIdFor, safePath } from "@/server/observability";

export async function updateSession(request: NextRequest) {
  const startedAt = Date.now();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(AUTH_FAILURE_HEADER);
  const availability = new AuthAvailability(undefined, fetch, (error) => {
    logHttpEvent({
      requestId: requestIdFor(request),
      route: safePath(request),
      operation: "auth.proxy",
      status: 503,
      result: "error",
      errorCode: `auth_${error.reason}`,
      durationMs: Date.now() - startedAt,
    });
  });
  requestHeaders.set(AUTH_DEADLINE_HEADER, String(availability.deadline));
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createSessionClient(
    {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        requestHeaders.set("cookie", request.cookies.toString());
        supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
    availability,
  );

  try {
    await supabase.auth.getClaims();
  } catch (error) {
    if (!(error instanceof AuthServiceUnavailableError)) throw error;
    requestHeaders.set(AUTH_FAILURE_HEADER, error.reason);
    // A refresh may have succeeded before user verification failed. Keep that
    // rotation: reverting to the old refresh token would invalidate recovery.
    // The session adapter already prevents cookie writes after the failure.
    const renewedCookies = supabaseResponse.cookies.getAll();
    supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
    renewedCookies.forEach((cookie) => supabaseResponse.cookies.set(cookie));
  }
  return supabaseResponse;
}
