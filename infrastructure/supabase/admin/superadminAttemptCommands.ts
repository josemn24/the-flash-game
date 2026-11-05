import "server-only";

import type {
  SuperadminAdjustResultInput,
  SuperadminAttemptCommandInput,
  SuperadminAttemptCommands,
} from "@/application/ports/superadmin-attempt-commands";
import {
  callAttemptCommand,
  type VerifiedAuthIdentity,
} from "@/infrastructure/supabase/attempts/attemptCommands";

export class SupabaseSuperadminAttemptCommands implements SuperadminAttemptCommands {
  constructor(private readonly identity: VerifiedAuthIdentity) {}

  adjust(input: SuperadminAdjustResultInput) {
    return callAttemptCommand(this.identity, "adjust_result", input);
  }

  invalidate(input: SuperadminAttemptCommandInput) {
    return callAttemptCommand(this.identity, "invalidate_attempt", input);
  }
}
