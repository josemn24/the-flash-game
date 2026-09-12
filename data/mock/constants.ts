import { mockId, utc } from "@/data/mock/identity";

export const DEMO_REFERENCE_TIME = utc("2026-09-12T12:00:00.000Z");
export const CONTENT_CREATED_AT = utc("2026-08-01T10:00:00.000Z");
export const CONTENT_PUBLISHED_AT = utc("2026-08-15T10:00:00.000Z");
export const ROOM_CREATED_AT = utc("2026-08-20T10:00:00.000Z");

export const demoIdentity = {
  currentPlayerId: mockId.player("player"),
  superadminPlayerId: mockId.player("dev-superadmin"),
} as const;

export const roomRouteAliases = {
  "tabarnia-room": mockId.room("tabarnia-room"),
} as const;

export const playerRouteAliases = {
  player: mockId.player("player"),
  ches: mockId.player("ches"),
  marta: mockId.player("marta"),
  alex: mockId.player("alex"),
  laura: mockId.player("laura"),
} as const;

export const scheduledChallengeRouteAliases = {
  "tabarnia-flash-01": mockId.scheduledChallenge("tabarnia-flash-01"),
  "tabarnia-challenge-02": mockId.scheduledChallenge("tabarnia-challenge-02"),
  "tabarnia-challenge-03": mockId.scheduledChallenge("tabarnia-challenge-03"),
  "tabarnia-challenge-04": mockId.scheduledChallenge("tabarnia-challenge-04"),
  "tabarnia-challenge-05": mockId.scheduledChallenge("tabarnia-challenge-05"),
  "tabarnia-challenge-06": mockId.scheduledChallenge("tabarnia-challenge-06"),
} as const;

export type RoomRouteKey = keyof typeof roomRouteAliases;
export type PlayerRouteKey = keyof typeof playerRouteAliases;
export type ScheduledChallengeRouteKey = keyof typeof scheduledChallengeRouteAliases;
