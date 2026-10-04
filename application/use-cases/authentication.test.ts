import { describe, expect, it, vi } from "vitest";
import type { AuthenticationGateway } from "@/application/ports/authentication";
import { ApplicationAuthenticationUseCases } from "./authentication";

function setup() {
  const gateway: AuthenticationGateway = {
    signIn: vi.fn(async () => ({ ok: true as const })),
    signOut: vi.fn(async () => ({ ok: true as const })),
  };
  return { gateway, useCases: new ApplicationAuthenticationUseCases(gateway) };
}

describe("authentication use cases", () => {
  it.each([
    null,
    "credentials",
    {},
    { email: 123, password: "password" },
    { email: "player@example.com", password: null },
    { email: "invalid-email", password: "password" },
    { email: "player@example.com", password: "short" },
  ])("rejects invalid action input without invoking the provider: %j", async (input) => {
    const { gateway, useCases } = setup();
    await expect(useCases.signIn(input)).resolves.toEqual({ ok: false, code: "credentials" });
    expect(gateway.signIn).not.toHaveBeenCalled();
  });

  it("trims the email and preserves password characters", async () => {
    const { gateway, useCases } = setup();
    await expect(
      useCases.signIn({ email: " player@example.com ", password: " password " }),
    ).resolves.toEqual({ ok: true });
    expect(gateway.signIn).toHaveBeenCalledWith({
      email: "player@example.com",
      password: " password ",
    });
  });

  it("preserves the port's provider-independent failure", async () => {
    const { gateway, useCases } = setup();
    vi.mocked(gateway.signIn).mockResolvedValue({ ok: false, code: "rate_limit" });
    await expect(
      useCases.signIn({ email: "player@example.com", password: "password" }),
    ).resolves.toEqual({
      ok: false,
      code: "rate_limit",
    });
  });

  it("closes the caller's session through the port", async () => {
    const { gateway, useCases } = setup();
    await expect(useCases.signOut()).resolves.toEqual({ ok: true });
    expect(gateway.signOut).toHaveBeenCalledExactlyOnceWith();
  });

  it.each(["signIn", "signOut"] as const)(
    "contains unexpected %s exceptions",
    async (operation) => {
      const { gateway, useCases } = setup();
      vi.mocked(gateway[operation]).mockRejectedValue(new Error("private provider detail"));
      const result =
        operation === "signIn"
          ? useCases.signIn({ email: "player@example.com", password: "password" })
          : useCases.signOut();
      await expect(result).resolves.toEqual({ ok: false, code: "unexpected" });
    },
  );
});
