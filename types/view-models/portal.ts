export type SuperadminPortalRoom = {
  readonly roomId: string;
  readonly slug: string;
  readonly title: string;
  readonly status: "active";
};

export type SuperadminPortalContext = {
  readonly operator: {
    readonly playerId: string;
    readonly displayName: string;
  };
  readonly rooms: readonly SuperadminPortalRoom[];
  readonly source: "supabase";
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
