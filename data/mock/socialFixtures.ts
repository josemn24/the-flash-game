import {
  CONTENT_CREATED_AT,
  CONTENT_PUBLISHED_AT,
  ROOM_CREATED_AT,
  playerRouteAliases,
  roomRouteAliases,
  scheduledChallengeRouteAliases,
  type PlayerRouteKey,
  type ScheduledChallengeRouteKey,
} from "@/data/mock/constants";
import { mockId, utc } from "@/data/mock/identity";
import type {
  PlatformRoleAssignment,
  Player,
  Room,
  RoomInvitation,
  RoomMembership,
  ScheduledChallenge,
  Season,
} from "@/types/domain";

const updatedAt = utc("2026-09-06T22:00:00.000Z");

const playerFixtures = [
  ["player", "Kike", "/flash-pop/avatars/player.jpeg"],
  ["ches", "Dark", "/flash-pop/avatars/ches.jpeg"],
  ["marta", "Jackobo", "/flash-pop/avatars/marta.jpeg"],
  ["alex", "Rielbe", "/flash-pop/avatars/alex.jpeg"],
  ["laura", "Palmera", "/flash-pop/avatars/laura.jpeg"],
] as const;

export const players: readonly Player[] = [
  ...playerFixtures.map(([key, displayName, avatarPath]) => ({
    id: playerRouteAliases[key],
    authUserId: mockId.authUser(key),
    displayName,
    avatarPath,
    status: "active" as const,
    anonymizedAt: null,
    createdAt: ROOM_CREATED_AT,
    updatedAt,
  })),
  {
    id: mockId.player("dev-superadmin"),
    authUserId: mockId.authUser("dev-superadmin"),
    displayName: "Desarrollador fantasma",
    avatarPath: null,
    status: "active",
    anonymizedAt: null,
    createdAt: ROOM_CREATED_AT,
    updatedAt,
  },
];

export const platformRoleAssignments: readonly PlatformRoleAssignment[] = [
  { playerId: mockId.player("dev-superadmin"), role: "superadmin" },
];

export const rooms: readonly Room[] = [
  {
    id: roomRouteAliases["tabarnia-room"],
    title: "Tabarnia",
    description: "Sala privada mock para la primera temporada de The Flash.",
    timeZone: "Europe/Madrid",
    status: "active",
    deletedAt: null,
    createdAt: ROOM_CREATED_AT,
    updatedAt,
  },
];

const membershipRoles: Readonly<Record<PlayerRouteKey, RoomMembership["role"]>> = {
  player: "owner",
  ches: "admin",
  marta: "member",
  alex: "member",
  laura: "member",
};

export const roomMemberships: readonly RoomMembership[] = playerFixtures.map(([key], index) => ({
  id: mockId.roomMembership(`tabarnia-room:${key}`),
  roomId: roomRouteAliases["tabarnia-room"],
  playerId: playerRouteAliases[key],
  role: membershipRoles[key],
  status: "active",
  joinedAt: utc(`2026-08-${String(20 + index).padStart(2, "0")}T10:00:00.000Z`),
  endedAt: null,
  createdAt: ROOM_CREATED_AT,
  updatedAt,
}));

export const roomInvitations: readonly RoomInvitation[] = [];

export const seasons: readonly Season[] = [
  {
    id: mockId.season("tabarnia-season-1"),
    roomId: roomRouteAliases["tabarnia-room"],
    title: "Primera temporada",
    status: "active",
    startsAt: utc("2026-08-31T22:00:00.000Z"),
    endsAt: utc("2026-09-20T22:00:00.000Z"),
    createdAt: ROOM_CREATED_AT,
    updatedAt,
  },
];

type ScheduleFixture = readonly [
  routeKey: ScheduledChallengeRouteKey,
  definitionSlug: string,
  number: number,
  opensAt: string,
  closesAt: string,
  status: ScheduledChallenge["status"],
];

const scheduleFixtures = [
  [
    "tabarnia-flash-01",
    "demo-challenge-definition",
    1,
    "2026-08-31T22:00:00.000Z",
    "2026-09-01T22:00:00.000Z",
    "closed",
  ],
  [
    "tabarnia-challenge-02",
    "animals-alphabet-definition",
    2,
    "2026-09-01T22:00:00.000Z",
    "2026-09-02T22:00:00.000Z",
    "closed",
  ],
  [
    "tabarnia-challenge-03",
    "spain-survival-definition",
    3,
    "2026-09-02T22:00:00.000Z",
    "2026-09-03T22:00:00.000Z",
    "closed",
  ],
  [
    "tabarnia-challenge-04",
    "antarctica-narrative-definition",
    4,
    "2026-09-03T22:00:00.000Z",
    "2026-09-04T22:00:00.000Z",
    "closed",
  ],
  [
    "tabarnia-challenge-05",
    "pyramid-logic-definition",
    5,
    "2026-09-04T22:00:00.000Z",
    "2026-09-05T22:00:00.000Z",
    "closed",
  ],
  [
    "tabarnia-challenge-06",
    "pyramid-abrahamic-definition",
    6,
    "2026-09-05T22:00:00.000Z",
    "2026-09-20T22:00:00.000Z",
    "open",
  ],
] as const satisfies readonly ScheduleFixture[];

export const scheduledChallenges: readonly ScheduledChallenge[] = scheduleFixtures.map(
  ([routeKey, definitionSlug, number, opensAt, closesAt, status]) => ({
    id: scheduledChallengeRouteAliases[routeKey],
    seasonId: mockId.season("tabarnia-season-1"),
    challengeVersionId: mockId.challengeVersion(`${definitionSlug}:v1`),
    number,
    status,
    opensAt: utc(opensAt),
    closesAt: utc(closesAt),
    cancelledAt: null,
    resultsLockedAt: status === "closed" ? utc(closesAt) : null,
    createdAt: CONTENT_CREATED_AT,
    updatedAt: status === "closed" ? utc(closesAt) : CONTENT_PUBLISHED_AT,
  }),
);

export type DemoScoreFixture = {
  readonly scheduledChallengeKey: ScheduledChallengeRouteKey;
  readonly playerKey: PlayerRouteKey;
  readonly score: number;
  readonly completedAt: string;
};

const scores = {
  "tabarnia-flash-01": { player: 42, ches: 54, marta: 47, alex: 38 },
  "tabarnia-challenge-02": { player: 31, ches: 44, marta: 39, alex: 28, laura: 36 },
  "tabarnia-challenge-03": { player: 27, ches: 38, marta: 35, alex: 29, laura: 31 },
  "tabarnia-challenge-04": { player: 36, ches: 54, marta: 60, alex: 24, laura: 31 },
  "tabarnia-challenge-05": { player: 33, ches: 52, marta: 44, alex: 39 },
} as const;

const completionTimes: Record<keyof typeof scores, string> = {
  "tabarnia-flash-01": "2026-09-01T20:30:00.000Z",
  "tabarnia-challenge-02": "2026-09-02T20:30:00.000Z",
  "tabarnia-challenge-03": "2026-09-03T21:45:00.000Z",
  "tabarnia-challenge-04": "2026-09-04T19:10:00.000Z",
  "tabarnia-challenge-05": "2026-09-05T20:30:00.000Z",
};

export const demoScoreFixtures: readonly DemoScoreFixture[] = Object.entries(scores).flatMap(
  ([scheduledChallengeKey, challengeScores]) =>
    Object.entries(challengeScores).map(([playerKey, score]) => ({
      scheduledChallengeKey: scheduledChallengeKey as keyof typeof scores,
      playerKey: playerKey as PlayerRouteKey,
      score,
      completedAt: completionTimes[scheduledChallengeKey as keyof typeof scores],
    })),
);
