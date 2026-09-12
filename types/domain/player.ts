import type { AuthUserId, PlayerId } from "@/types/domain/identifiers";
import type { EntityTimestamps, UtcIsoDateTime } from "@/types/domain/values";

export type PlayerStatus = "active" | "anonymized";
export type PlatformRole = "superadmin";

export type Player = EntityTimestamps & {
  readonly id: PlayerId;
  readonly authUserId: AuthUserId | null;
  readonly displayName: string;
  readonly avatarPath: string | null;
  readonly status: PlayerStatus;
  readonly anonymizedAt: UtcIsoDateTime | null;
};
