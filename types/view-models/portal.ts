import type { SeasonStatus } from "@/types/domain/season";
import type { SuperadminEditorialContext } from "@/types/view-models/editorial";

export type SuperadminPortalSeason = {
  readonly seasonId: string;
  readonly title: string;
  readonly status: SeasonStatus;
  readonly startsAt: string;
  readonly endsAt: string;
};

export type SuperadminPortalRoom = {
  readonly roomId: string;
  readonly slug: string;
  readonly title: string;
  readonly timeZone: string;
  readonly status: "active";
  readonly seasons: readonly SuperadminPortalSeason[];
};

export type SuperadminPortalContext = {
  readonly operator: {
    readonly playerId: string;
    readonly displayName: string;
  };
  readonly rooms: readonly SuperadminPortalRoom[];
  readonly source: "supabase";
  readonly editorial?: SuperadminEditorialContext;
};

export type SuperadminPlayerCandidate = {
  readonly email: string;
  readonly playerId: string;
  readonly displayName: string;
};

export type SuperadminRoomCreationResult = {
  readonly roomId: string;
  readonly slug: string;
  readonly title: string;
  readonly timeZone: string;
  readonly owner: {
    readonly playerId: string;
    readonly displayName: string;
  };
  readonly memberCount: number;
  readonly source: "supabase";
};

export type SuperadminSeasonCommandResult = SuperadminPortalSeason & {
  readonly roomId: string;
  readonly source: "supabase";
};
