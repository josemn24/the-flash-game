import type { PlayerId } from "@/types/domain/identifiers";

/**
 * Identity resolved by the server before entering an application use case.
 * It is never accepted from a browser payload.
 */
export type AuthenticatedActor = {
  readonly authUserId: string;
  readonly playerId?: PlayerId;
};

export interface AttemptSessionTokenGenerator {
  generate(): string;
}
