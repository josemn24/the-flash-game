import type { AuthenticationGateway } from "@/application/ports/authentication";
import type { AuthenticationResult } from "@/types/contracts/authentication";

export class ApplicationAuthenticationUseCases {
  constructor(private readonly authentication: AuthenticationGateway) {}

  async signIn(input: unknown): Promise<AuthenticationResult> {
    if (
      !input ||
      typeof input !== "object" ||
      !("email" in input) ||
      !("password" in input) ||
      typeof input.email !== "string" ||
      typeof input.password !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
      input.password.length < 6
    ) {
      return { ok: false, code: "credentials" };
    }

    try {
      return await this.authentication.signIn({
        email: input.email.trim(),
        password: input.password,
      });
    } catch {
      return { ok: false, code: "unexpected" };
    }
  }

  async signOut(): Promise<AuthenticationResult> {
    try {
      return await this.authentication.signOut();
    } catch {
      return { ok: false, code: "unexpected" };
    }
  }
}
