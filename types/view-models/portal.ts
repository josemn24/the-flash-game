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

export type SuperadminRoomMember = {
  readonly playerId: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly avatarSrc?: string;
  readonly role: "owner" | "admin" | "member" | "spectator";
  readonly joinedAt: string;
};

export type SuperadminRoomDetailData = {
  readonly room: SuperadminPortalRoom;
  readonly members: readonly SuperadminRoomMember[];
  readonly source: "supabase";
};

export type SuperadminRoomDetailModel = {
  readonly operator: SuperadminPortalContext["operator"];
  readonly room: SuperadminPortalRoom;
  readonly members: readonly SuperadminRoomMember[];
  readonly calendar: SuperadminCalendarContext;
  readonly publishedContent: readonly SuperadminEditorialContext["entries"][number][];
  readonly source: "supabase";
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

export type AdminSection = "overview" | "rooms" | "content" | "questions";

export type SuperadminDashboardRoom = {
  readonly roomId: string;
  readonly slug: string;
  readonly title: string;
  readonly timeZone: string;
  readonly seasonCount: number;
  readonly activeSeason: {
    readonly title: string;
    readonly startsAt: string;
    readonly endsAt: string;
  } | null;
};

export type SuperadminDashboardUpcomingChallenge = {
  readonly scheduledChallengeId: string;
  readonly roomId: string;
  readonly roomTitle: string;
  readonly seasonId: string;
  readonly seasonTitle: string;
  readonly challengeVersionId: string;
  readonly challengeTitle: string;
  readonly number: number;
  readonly status: "scheduled" | "open";
  readonly opensAt: string;
  readonly closesAt: string;
  readonly timeZone: string;
};

export type SuperadminDashboardAlert = {
  readonly id: string;
  readonly tone: "info" | "warning";
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly actionLabel: string;
};

export type SuperadminDashboardAction = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
};

export type SuperadminDashboardModel = {
  readonly operator: SuperadminPortalContext["operator"];
  readonly metrics: {
    readonly activeRooms: number;
    readonly activeSeasons: number;
    readonly pendingSeasons: number;
    readonly editorialDrafts: number;
    readonly upcomingChallenges: number;
  };
  readonly rooms: readonly SuperadminDashboardRoom[];
  readonly upcomingChallenges: readonly SuperadminDashboardUpcomingChallenge[];
  readonly alerts: readonly SuperadminDashboardAlert[];
  readonly actions: readonly SuperadminDashboardAction[];
  readonly source: "supabase";
};

export type SuperadminRoomsPageModel = {
  readonly operator: SuperadminPortalContext["operator"];
  readonly rooms: readonly SuperadminPortalRoom[];
  readonly source: "supabase";
};

export type SuperadminContentPageModel = {
  readonly operator: SuperadminPortalContext["operator"];
  readonly editorial: SuperadminEditorialContext;
  readonly questionLibrary: SuperadminQuestionLibraryContext;
};

export type SuperadminCalendarPageModel = {
  readonly operator: SuperadminPortalContext["operator"];
  readonly context: SuperadminPortalContext;
  readonly calendar: SuperadminCalendarContext;
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
