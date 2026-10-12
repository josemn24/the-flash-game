/** Synthetic credentials for outage tests; never accepted by a real Auth server. */
export function syntheticSession(expired = true) {
  const encode = (data: unknown) => Buffer.from(JSON.stringify(data)).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + (expired ? -3600 : 3600);
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "outage@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: expiresAt })}.${Buffer.from("synthetic-test-signature").toString("base64url")}`;
  const session = {
    access_token: token,
    refresh_token: "synthetic-outage-refresh-token",
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  return { session, cookie: { name: "sb-127-auth-token", value: `base64-${encode(session)}` } };
}
