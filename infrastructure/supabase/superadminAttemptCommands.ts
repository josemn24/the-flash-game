import "server-only";

import type {
  SuperadminAdjustResultInput,
  SuperadminAdministrativeResult,
  SuperadminAttemptCommandInput,
  SuperadminAttemptCommands,
} from "@/application/ports/superadmin-attempt-commands";
import {
  callAttemptCommand,
  type VerifiedAuthIdentity,
} from "@/infrastructure/supabase/attemptCommands";

export class SupabaseSuperadminAttemptCommands implements SuperadminAttemptCommands {
  constructor(private readonly identity: VerifiedAuthIdentity) {}

  adjust(input: SuperadminAdjustResultInput) {
    return callAttemptCommand<SuperadminAdministrativeResult>(
      this.identity,
      "adjust_result",
      input,
    );
  }

  invalidate(input: SuperadminAttemptCommandInput) {
    return callAttemptCommand<SuperadminAdministrativeResult>(
      this.identity,
      "invalidate_attempt",
      input,
    );
  }
}
