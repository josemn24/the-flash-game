import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseAuthentication } from "./authentication";
import { AuthServiceUnavailableError } from "@/infrastructure/supabase/auth/auth-availability";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/auth/server-client", () => ({
  createClient: mocks.createClient,
}));
const credentials = { email: "player@example.com", password: "test-password" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockResolvedValue({
    auth: { signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut },
  });
  mocks.signInWithPassword.mockResolvedValue({
    data: { session: { access_token: "private-token" }, user: { id: "private-id" } },
    error: null,
  });
  mocks.signOut.mockResolvedValue({ error: null });
});

describe("Supabase authentication adapter", () => {
  it("uses a request-scoped client and returns neither sessions nor tokens", async () => {
    await expect(supabaseAuthentication.signIn(credentials)).resolves.toEqual({ ok: true });
    await expect(supabaseAuthentication.signOut()).resolves.toEqual({ ok: true });
    expect(mocks.createClient).toHaveBeenCalledTimes(2);
    expect(mocks.signInWithPassword).toHaveBeenCalledWith(credentials);
    expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith();
  });

  it.each([
    [new AuthServiceUnavailableError("connection"), "connection"],
    [new AuthServiceUnavailableError("service"), "service"],
    [new AuthServiceUnavailableError("timeout"), "service"],
    [new AuthApiError("private", 400, "invalid_credentials"), "credentials"],
    [new AuthApiError("private", 429, undefined), "rate_limit"],
    [new AuthApiError("private", 400, "over_request_rate_limit"), "rate_limit"],
    [new AuthRetryableFetchError("private", 503), "service"],
    [new AuthApiError("private", 504, "request_timeout"), "service"],
    [new AuthApiError("private", 408, "request_timeout"), "service"],
    [new AuthRetryableFetchError("private", 0), "connection"],
    [new AuthApiError("invalid_credentials", 400, undefined), "unexpected"],
    [new Error("invalid_credentials"), "unexpected"],
  ])("translates returned and thrown SDK errors by metadata: %s", async (error, code) => {
    for (const operation of ["signIn", "signOut"] as const) {
      const provider = operation === "signIn" ? mocks.signInWithPassword : mocks.signOut;
      provider.mockResolvedValueOnce({ error });
      provider.mockRejectedValueOnce(error);
      for (let attempt = 0; attempt < 2; attempt++) {
        const result =
          operation === "signIn"
            ? supabaseAuthentication.signIn(credentials)
            : supabaseAuthentication.signOut();
        await expect(result).resolves.toEqual({ ok: false, code });
      }
    }
  });

  it("contains client creation failures before either provider operation", async () => {
    mocks.createClient.mockRejectedValue(new Error("private configuration"));
    await expect(supabaseAuthentication.signIn(credentials)).resolves.toEqual({
      ok: false,
      code: "unexpected",
    });
    await expect(supabaseAuthentication.signOut()).resolves.toEqual({
      ok: false,
      code: "unexpected",
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
