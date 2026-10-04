export type AuthenticationFailureCode =
  "credentials" | "connection" | "service" | "rate_limit" | "unexpected";

export type AuthenticationResult =
  { readonly ok: true } | { readonly ok: false; readonly code: AuthenticationFailureCode };

export type SignInCredentials = {
  readonly email: string;
  readonly password: string;
};
