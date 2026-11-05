import type { AttemptErrorCode } from "@/types/contracts/competitive-errors";

export class AttemptCommandError extends Error {
  constructor(
    readonly code: AttemptErrorCode,
    cause?: unknown,
    readonly retryAfterSeconds?: number,
  ) {
    super(code, { cause });
    this.name = "AttemptCommandError";
  }
}
