import "server-only";

import type {
  SuperadminAdjustResultInput,
  SuperadminAdministrativeResult,
  SuperadminAttemptCommandInput,
  SuperadminAttemptCommands,
} from "@/application/ports/superadmin-attempt-commands";
import { SuperadminAttemptCommandError } from "@/application/administration/errors";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";
import { productionAdminServices } from "@/server/composition/admin";

function runCommand<T>(operation: () => Promise<T>) {
  return operation().catch((error: unknown) => {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (
      error instanceof Error &&
      error.name === "AttemptCommandError" &&
      typeof code === "string"
    ) {
      throw new SuperadminAttemptCommandError(code, error);
    }
    throw error;
  });
}

export function adjustSuperadminAttempt(
  authUserId: string,
  input: SuperadminAdjustResultInput,
  commands?: SuperadminAttemptCommands,
): Promise<SuperadminAdministrativeResult> {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return runCommand(() => commands.adjust(input));
  }
  void authUserId;
  return runCommand(() => productionAdminServices.commands.adjustAttempt(input));
}

export function invalidateSuperadminAttempt(
  authUserId: string,
  input: SuperadminAttemptCommandInput,
  commands?: SuperadminAttemptCommands,
): Promise<SuperadminAdministrativeResult> {
  if (commands) {
    consumeAdminRateLimit("superadmin");
    return runCommand(() => commands.invalidate(input));
  }
  void authUserId;
  return runCommand(() => productionAdminServices.commands.invalidateAttempt(input));
}
