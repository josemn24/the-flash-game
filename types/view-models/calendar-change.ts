export type CalendarChangeInput = {
  readonly seasonId: string;
  readonly expectedUpdatedAt: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly publications: readonly {
    readonly scheduledChallengeId: string;
    readonly expectedUpdatedAt: string;
    readonly opensAt: string;
    readonly closesAt: string;
  }[];
};

export type CalendarChangePreview = {
  readonly evaluatedAt: string;
  readonly roomId: string;
  readonly seasonId: string;
  readonly season: {
    readonly before: { readonly startsAt: string; readonly endsAt: string };
    readonly after: { readonly startsAt: string; readonly endsAt: string };
  };
  readonly publications: readonly {
    readonly scheduledChallengeId: string;
    readonly number: number;
    readonly before: { readonly opensAt: string; readonly closesAt: string };
    readonly after: { readonly opensAt: string; readonly closesAt: string };
  }[];
  readonly changed?: boolean;
};
