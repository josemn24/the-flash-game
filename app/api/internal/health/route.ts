import { readPrivateHealth } from "@/server/health";
import { getRuntimeScope } from "@/server/runtime-scope";
import { jsonResponse, logHttpEvent, requestIdFor, safePath } from "@/server/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasValidSecret(request: Request) {
  const secret = process.env.HEALTHCHECK_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = requestIdFor(request);
  const operation = "internal.health";
  if (!process.env.HEALTHCHECK_SECRET) {
    logHttpEvent({
      requestId,
      route: safePath(request),
      operation,
      status: 503,
      result: "error",
      errorCode: "healthcheck_unavailable",
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse({ error: { code: "healthcheck_unavailable", requestId } }, 503, requestId);
  }
  if (!hasValidSecret(request)) {
    logHttpEvent({
      requestId,
      route: safePath(request),
      operation,
      status: 401,
      result: "error",
      errorCode: "not_authorized",
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse({ error: { code: "not_authorized", requestId } }, 401, requestId);
  }

  try {
    const health = await readPrivateHealth();
    const status = health.ok ? 200 : 503;
    logHttpEvent({
      requestId,
      route: safePath(request),
      operation,
      status,
      result: health.ok ? "ok" : "error",
      ...(health.ok ? {} : { errorCode: "dependency_unavailable" }),
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse(
      {
        status: health.ok ? "ok" : "degraded",
        scope: getRuntimeScope(),
        checks: health.checks,
        requestId,
      },
      status,
      requestId,
    );
  } catch {
    logHttpEvent({
      requestId,
      route: safePath(request),
      operation,
      status: 503,
      result: "error",
      errorCode: "dependency_unavailable",
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse({ error: { code: "dependency_unavailable", requestId } }, 503, requestId);
  }
}
