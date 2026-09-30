export class AttemptCommandError extends Error {
  readonly code: string;

  constructor(code: string, cause?: unknown) {
    super(code, { cause });
    this.name = "AttemptCommandError";
    this.code = code;
  }
}
