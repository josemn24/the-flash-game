import type { MatchingAnswer } from "@/types/compat/game";

export const MATCHING_PAIR_TONES = ["violet", "blue", "amber", "pink", "teal", "orange"] as const;

export type MatchingPairTone = (typeof MATCHING_PAIR_TONES)[number];

export type MatchingPairPresentation = {
  readonly leftId: string;
  readonly rightId: string;
  readonly pairNumber: number;
  readonly pairTone: MatchingPairTone;
};

export type MatchingPairPresentationMaps = {
  readonly byLeft: Readonly<Record<string, MatchingPairPresentation>>;
  readonly byRight: Readonly<Record<string, MatchingPairPresentation>>;
};

export function getMatchingPairPresentation(
  leftItems: readonly { readonly id: string }[],
  answer: MatchingAnswer,
): MatchingPairPresentationMaps {
  const leftPositions = new Map(leftItems.map((item, index) => [item.id, index]));
  const byLeft: Record<string, MatchingPairPresentation> = {};
  const byRight: Record<string, MatchingPairPresentation> = {};

  for (const [leftId, rightId] of Object.entries(answer)) {
    const leftPosition = leftPositions.get(leftId);
    if (leftPosition === undefined) continue;

    const presentation: MatchingPairPresentation = {
      leftId,
      rightId,
      pairNumber: leftPosition + 1,
      pairTone: MATCHING_PAIR_TONES[leftPosition % MATCHING_PAIR_TONES.length],
    };

    byLeft[leftId] = presentation;
    byRight[rightId] = presentation;
  }

  return { byLeft, byRight };
}
