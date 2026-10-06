import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { AUTH_DEADLINE_HEADER, AUTH_FAILURE_HEADER } from "@/lib/supabase/auth-availability";
import {
  isDesignSystemAvailable,
  isDesignSystemPath,
  isKnownDesignSystemPath,
} from "@/features/design-system/access";

export async function proxy(request: NextRequest) {
  if (isDesignSystemPath(request.nextUrl.pathname)) {
    // Validate before streaming starts: a page-level notFound can otherwise return HTTP 200.
    if (
      !isDesignSystemAvailable(process.env.NODE_ENV) ||
      !isKnownDesignSystemPath(request.nextUrl.pathname)
    ) {
      return new NextResponse("Not Found", {
        status: 404,
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
      });
    }
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete(AUTH_DEADLINE_HEADER);
    requestHeaders.delete(AUTH_FAILURE_HEADER);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
