import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "./session-client";
import {
  AUTH_DEADLINE_HEADER,
  AUTH_FAILURE_HEADER,
  AUTH_USER_ID_HEADER,
  AuthAvailability,
  AuthServiceUnavailableError,
} from "./auth-availability";
import { logHttpEvent, requestIdFor, safePath } from "@/infrastructure/observability/http";

export async function updateSession(request: NextRequest) {
  const startedAt = Date.now();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(AUTH_FAILURE_HEADER);
  requestHeaders.delete(AUTH_USER_ID_HEADER);
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
    const { data, error } = await supabase.auth.getUser();
    const authUserId = data.user?.id;
    if (!error && typeof authUserId === "string" && authUserId.length > 0) {
      // Auth returned this subject; reuse it in the render instead of making
      // a second Auth request for the same session.
      requestHeaders.set(AUTH_USER_ID_HEADER, authUserId);
    }
  } catch (error) {
    if (!(error instanceof AuthServiceUnavailableError)) throw error;
    requestHeaders.set(AUTH_FAILURE_HEADER, error.reason);
    requestHeaders.delete(AUTH_USER_ID_HEADER);
    // A refresh may have succeeded before user verification failed. Keep that
    // rotation: reverting to the old refresh token would invalidate recovery.
    // The session adapter already prevents cookie writes after the failure.
    const renewedCookies = supabaseResponse.cookies.getAll();
    supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
    renewedCookies.forEach((cookie) => supabaseResponse.cookies.set(cookie));
  }

  // Rebuild after claim verification so Next forwards the trusted identity
  // header together with any cookies refreshed by the Supabase client.
  const responseCookies = supabaseResponse.cookies.getAll();
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  responseCookies.forEach(({ name, value, ...options }) =>
    response.cookies.set(name, value, options),
  );
  return response;
}
