export const PRODUCT_EVENT_TYPES = [
  "room_viewed",
  "challenge_intro_viewed",
  "ranking_viewed",
  "review_viewed",
  "rehearsal_started",
  "rehearsal_completed",
] as const;
export type ProductEventType = (typeof PRODUCT_EVENT_TYPES)[number];
export type ProductEventInput = {
  eventId: string;
  type: ProductEventType;
  roomId: string;
  publicationId?: string;
  visitId: string;
  occurredAt: string;
  appVersion: string;
};
export type ProductRating = {
  eligible: boolean;
  value: number | null;
  seasonId?: string;
  closesAt?: string;
};
export type ProductRatingInput = {
  id: string;
  publicationId: string;
  seasonId: string;
  value: number;
};
