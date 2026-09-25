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

export class SuperadminRoomCommandError extends Error {
  readonly code: string;

  constructor(code: string, cause?: unknown) {
    super(code, { cause });
    this.name = "SuperadminRoomCommandError";
    this.code = code;
  }
}

export class SuperadminSeasonCommandError extends Error {
  readonly code: string;

  constructor(code: string, cause?: unknown) {
    super(code, { cause });
    this.name = "SuperadminSeasonCommandError";
    this.code = code;
  }
}

export class SuperadminEditorialCommandError extends Error {
  readonly code: string;

  constructor(code: string, cause?: unknown) {
    super(code, { cause });
    this.name = "SuperadminEditorialCommandError";
    this.code = code;
  }
}

export class SuperadminCalendarCommandError extends Error {
  readonly code: string;

  constructor(code: string, cause?: unknown) {
    super(code, { cause });
    this.name = "SuperadminCalendarCommandError";
    this.code = code;
  }
}

export class RoomMembershipCommandError extends Error {
  readonly code: string;

  constructor(code: string, cause?: unknown) {
    super(code, { cause });
    this.name = "RoomMembershipCommandError";
    this.code = code;
  }
}

export class SuperadminUserCommandError extends Error {
  readonly code: string;

  constructor(code: string, cause?: unknown) {
    super(code, { cause });
    this.name = "SuperadminUserCommandError";
    this.code = code;
  }
}

export class SuperadminAttemptCommandError extends Error {
  readonly code: string;

  constructor(code: string, cause?: unknown) {
    super(code, { cause });
    this.name = "SuperadminAttemptCommandError";
    this.code = code;
  }
}
