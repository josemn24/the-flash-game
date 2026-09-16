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
