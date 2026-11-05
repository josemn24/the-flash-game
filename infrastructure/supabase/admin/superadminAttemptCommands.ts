import "server-only";

import type {
  PurgeTerminalAttemptInput,
  SuperadminAdjustResultInput,
  SuperadminAttemptCommandInput,
  SuperadminAttemptCommands,
} from "@/application/ports/superadmin-attempt-commands";
import {
  callAttemptCommand,
  purgeTerminalAttempt,
  type VerifiedAuthIdentity,
} from "@/infrastructure/supabase/attempts/attemptCommands";

export class SupabaseSuperadminAttemptCommands implements SuperadminAttemptCommands {
  constructor(private readonly identity: VerifiedAuthIdentity) {}

  purge(input: PurgeTerminalAttemptInput) {
    return purgeTerminalAttempt(this.identity, input);
  }

  adjust(input: SuperadminAdjustResultInput) {
    return callAttemptCommand(this.identity, "adjust_result", input);
  }

  invalidate(input: SuperadminAttemptCommandInput) {
    return callAttemptCommand(this.identity, "invalidate_attempt", input);
  }
}
