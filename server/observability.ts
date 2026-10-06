import "server-only";

export {
  logHttpEvent,
  requestIdFor,
  safePath,
  type HttpLogFields,
} from "@/infrastructure/observability/http";

export function jsonResponse(
  value: unknown,
  status: number,
  requestId: string,
  headers: HeadersInit = {},
) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      ...headers,
    },
  });
}
