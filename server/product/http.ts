import "server-only";
import { assertSameOrigin } from "@/server/competitive/attempt-api";
import { NextResponse } from "next/server";
export async function productBody(request: Request): Promise<Record<string, unknown>> {
  assertSameOrigin(request);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new Error("invalid_content_type");
  if (Number(request.headers.get("content-length")) > 4096) throw new Error("body_too_large");
  if (!request.body) throw new Error("invalid_json");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4096) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const raw = new TextDecoder().decode(bytes);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("invalid_json");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_body");
  return value as Record<string, unknown>;
}
export function productError(error: unknown) {
  const message = error instanceof Error ? error.message : "measurement_unavailable";
  const forbidden = message.includes("not_authorized") || message === "invalid_origin";
  const rate = message.includes("measurement_rate_limited");
  const invalid = message.startsWith("invalid_") || message === "body_too_large";
  return NextResponse.json(
    {
      error: forbidden
        ? "not_authorized"
        : rate
          ? "measurement_rate_limited"
          : invalid
            ? message
            : "measurement_unavailable",
    },
    {
      status: forbidden ? 403 : rate ? 429 : invalid ? 400 : 503,
      headers: { "Cache-Control": "no-store", ...(rate ? { "Retry-After": "60" } : {}) },
    },
  );
}
