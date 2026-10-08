import type { SuperadminPortalContext } from "@/types/view-models";
import type { CurrentViewerReader } from "./current-viewer";
import type { SuperadminPortalQueries } from "@/application/queries";

export interface AuthenticatedUserReader {
  getAuthenticatedUserId(): Promise<string | null>;
}

export interface AdminRateLimiter {
  consume(key: string): void;
}

export interface RequestIdGenerator {
  generate(): string;
}

export interface SuperadminAuthAdmin {
  createOrRecoverUser(input: {
    readonly email: string;
    readonly password: string;
    readonly displayName: string;
    readonly idempotencyKey: string;
  }): Promise<string>;
}

export type SuperadminActor = {
  readonly playerId: string;
  readonly displayName: string;
  readonly requestId: string;
};

export type SuperadminAccess = {
  readonly actor: SuperadminActor;
  readonly context: SuperadminPortalContext;
  readonly authUserId: string;
};

export type SuperadminAccessDependencies = {
  readonly currentViewer: CurrentViewerReader;
  readonly authenticatedUser: AuthenticatedUserReader;
  readonly portalQueries: Pick<SuperadminPortalQueries, "getContext">;
  readonly requestIds: RequestIdGenerator;
};
