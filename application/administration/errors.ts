export class AuthenticationRequiredError extends Error {
  readonly code = "authentication_required" as const;

  constructor() {
    super("An authenticated session is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class SuperadminAccessDeniedError extends Error {
  readonly code = "superadmin_access_denied" as const;

  constructor() {
    super("The authenticated user is not a superadmin.");
    this.name = "SuperadminAccessDeniedError";
  }
}
