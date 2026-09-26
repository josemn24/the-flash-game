import "server-only";

import type {
  SuperadminAdjustResultInput,
  SuperadminAdministrativeResult,
  SuperadminAttemptCommandInput,
  SuperadminAttemptCommands,
} from "@/application/ports/superadmin-attempt-commands";
import { SuperadminAttemptCommandError } from "@/application/administration/errors";
import { SupabaseSuperadminAttemptCommands } from "@/infrastructure/supabase/superadminAttemptCommands";
import {
  AttemptCommandError,
  type VerifiedAuthIdentity,
} from "@/infrastructure/supabase/attemptCommands";
import { consumeAdminRateLimit } from "@/server/competitive/rate-limit";

function commandFor(authUserId: string, commands?: SuperadminAttemptCommands) {
  return commands ?? new SupabaseSuperadminAttemptCommands({ authUserId });
}

function runCommand<T>(operation: () => Promise<T>) {
  return operation().catch((error: unknown) => {
    if (error instanceof AttemptCommandError) {
      throw new SuperadminAttemptCommandError(error.code, error);
    }
    throw error;
  });
}

export function adjustSuperadminAttempt(
  authUserId: VerifiedAuthIdentity["authUserId"],
  input: SuperadminAdjustResultInput,
  commands?: SuperadminAttemptCommands,
): Promise<SuperadminAdministrativeResult> {
  consumeAdminRateLimit("superadmin");
  return runCommand(() => commandFor(authUserId, commands).adjust(input));
}

export function invalidateSuperadminAttempt(
  authUserId: VerifiedAuthIdentity["authUserId"],
  input: SuperadminAttemptCommandInput,
  commands?: SuperadminAttemptCommands,
): Promise<SuperadminAdministrativeResult> {
  consumeAdminRateLimit("superadmin");
  return runCommand(() => commandFor(authUserId, commands).invalidate(input));
}
