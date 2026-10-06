export type CompetitiveJsonObject = Record<string, unknown>;

export type CompetitiveResponseParser<T> = (value: unknown) => T;

export class CompetitiveCommandError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "CompetitiveCommandError";
  }
}

export function createCompetitiveIdempotencyKey(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

export function parseCompetitiveTimestamp(value: unknown): number {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(timestamp)) throw new Error("invalid_server_timestamp");
  return timestamp;
}

export function parseCompetitiveObject(value: unknown): CompetitiveJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CompetitiveCommandError("invalid_json_response", 200);
  }
  return value as CompetitiveJsonObject;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function errorCode(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const error = (value as CompetitiveJsonObject).error;
    if (error && typeof error === "object" && !Array.isArray(error)) {
      const code = (error as CompetitiveJsonObject).code;
      if (typeof code === "string" && code.length > 0) return code;
    }
  }
  return "competitive_command_failed";
}

export async function postCompetitiveJson<T>(
  path: string,
  body: object,
  parser: CompetitiveResponseParser<T>,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => {
      controller.abort();
      reject(new CompetitiveCommandError("request_cancelled", 0));
    };
    if (options.signal?.aborted) onAbort();
    else options.signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new CompetitiveCommandError("request_timeout", 0));
    }, options.timeoutMs ?? 5000);
  });
  try {
    if (options.signal?.aborted) return await cancelled;
    return await Promise.race([
      cancelled,
      (async () => {
        const response = await fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
        let value: unknown;
        try {
          value = await response.json();
        } catch {
          throw new CompetitiveCommandError(
            response.ok ? "invalid_json_response" : "competitive_command_failed",
            response.status,
            retryAfterSeconds,
          );
        }
        if (!response.ok)
          throw new CompetitiveCommandError(errorCode(value), response.status, retryAfterSeconds);
        return parser(value);
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    if (onAbort) options.signal?.removeEventListener("abort", onAbort);
  }
}
