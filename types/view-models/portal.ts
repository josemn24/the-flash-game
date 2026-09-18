import type { SeasonStatus } from "@/types/domain/season";
import type {
  SuperadminEditorialContext,
  SuperadminQuestionLibraryContext,
} from "@/types/view-models/editorial";

export type SuperadminCalendarEntry = {
  readonly scheduledChallengeId: string;
  readonly roomId: string;
  readonly roomSlug: string;
  readonly roomTitle: string;
  readonly timeZone: string;
  readonly seasonId: string;
  readonly seasonTitle: string;
  readonly seasonStatus: SeasonStatus;
  readonly challengeVersionId: string;
  readonly challengeSlug: string;
  readonly versionNumber: number;
  readonly challengeTitle: string;
  readonly challengeSubtitle: string;
  readonly mode: "flash";
  readonly number: number;
  readonly status: "scheduled" | "open" | "closed" | "cancelled";
  readonly opensAt: string;
  readonly closesAt: string;
  readonly updatedAt: string;
};

export type SuperadminCalendarContext = {
  readonly entries: readonly SuperadminCalendarEntry[];
  readonly source: "supabase";
};

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
  readonly questionLibrary?: SuperadminQuestionLibraryContext;
  readonly calendar?: SuperadminCalendarContext;
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

export type SuperadminCalendarCommandResult = {
  readonly scheduledChallengeId: string;
  readonly roomId: string;
  readonly seasonId: string;
  readonly challengeVersionId: string;
  readonly number: number;
  readonly status: "scheduled" | "open" | "closed" | "cancelled";
  readonly opensAt: string;
  readonly closesAt: string;
  readonly updatedAt: string;
  readonly source: "supabase";
};
