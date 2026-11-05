import "server-only";

/** Preserve SQL diagnostics while giving transport/configuration failures a stable code. */
export function serviceRpcError(error: unknown, status?: number) {
  const fields = error && typeof error === "object" ? error : {};
  const code = "code" in fields && typeof fields.code === "string" ? fields.code : "";
  const message =
    "message" in fields && typeof fields.message === "string" ? fields.message : "command_failed";
  const unavailable =
    !code ||
    code.startsWith("08") ||
    ["28P01", "28000", "42501", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EPIPE"].includes(code) ||
    /^PGRST(?:00[0-3]|202|30[0-3])$/.test(code) ||
    status === 401 ||
    status === 403 ||
    [502, 503, 504].includes(status ?? 0);

  return Object.assign(
    new Error(unavailable ? "database_unavailable" : message, { cause: error }),
    {
      code: unavailable ? "database_unavailable" : code,
    },
  );
}
