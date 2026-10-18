import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/infrastructure/supabase/auth/proxy";
import {
  AUTH_DEADLINE_HEADER,
  AUTH_FAILURE_HEADER,
} from "@/infrastructure/supabase/auth/auth-availability";
import {
  isDesignSystemAvailable,
  isDesignSystemPath,
  isKnownDesignSystemPath,
} from "@/features/design-system/access";
import {
  FLASH_POP_CHALLENGE_ID,
  FLASH_POP_FLASH_PILOT_ID,
  FLASH_POP_SURVIVAL_PILOT_ID,
  FLASH_POP_TIME_TRIAL_CONNECT_PAIRS_ID,
  FLASH_POP_TIME_TRIAL_QUEENS_ID,
} from "@/features/flash-pop/demoSocial";

const pyramidDemoPrefix = "/demo/flash-pop/desafios/";

function localCompetitiveDemoResponse(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/demo/flash-pop" || pathname === "/demo/flash-pop/") {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete(AUTH_DEADLINE_HEADER);
    requestHeaders.delete(AUTH_FAILURE_HEADER);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  if (!/^\/demo\/flash-pop\/desafios\/[^/]+\/?$/.test(pathname)) return null;
  const challengeId = pathname.slice(pyramidDemoPrefix.length).replace(/\/$/, "");
  if (
    ![
      FLASH_POP_CHALLENGE_ID,
      FLASH_POP_FLASH_PILOT_ID,
      FLASH_POP_SURVIVAL_PILOT_ID,
      FLASH_POP_TIME_TRIAL_QUEENS_ID,
      FLASH_POP_TIME_TRIAL_CONNECT_PAIRS_ID,
    ].includes(challengeId)
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
  const localCompetitiveResponse = localCompetitiveDemoResponse(request);
  if (localCompetitiveResponse) return localCompetitiveResponse;
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
