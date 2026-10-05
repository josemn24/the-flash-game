import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
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
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
