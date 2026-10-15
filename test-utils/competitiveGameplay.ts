import type {
  CompetitiveChallenge,
  ServerFlashChallenge,
  ServerMiniWordleQuestion,
} from "@/types/gameplay";
import type {
  CompetitiveChallengePageModel,
  GameRoomContext,
  FlashPopSocialSnapshot,
} from "@/types/view-models";

const base = {
  id: "publication",
  definitionId: "definition",
  number: 1,
  title: "Desafío público",
  subtitle: "",
  description: "",
  maxScore: 100,
};
const slot = {
  id: "item",
  position: 1,
  questionType: "multiple-choice" as const,
  payloadSchemaVersion: 1,
  timeLimitMs: 60000,
  points: 100,
};
export const competitiveFlash: ServerFlashChallenge = { ...base, mode: "flash", slots: [slot] };
export const competitiveChallenges: readonly CompetitiveChallenge[] = [
  competitiveFlash,
  {
    ...base,
    mode: "alphabet",
    timeLimitMs: 60000,
    entries: [{ ...slot, questionType: "short-text", letter: "A" }],
  },
  { ...base, mode: "survival", lives: 2, slots: [slot] },
  {
    ...base,
    mode: "pyramid",
    attemptVersion: 1,
    availableFrom: "2026-10-01T00:00:00Z",
    availableUntil: "2026-11-01T00:00:00Z",
    levels: [
      {
        ...slot,
        levelId: "level",
        label: "Nivel 1",
        briefing: { title: "Nivel", format: "Elección múltiple", description: "" },
      },
    ],
  },
  { ...base, mode: "narrative", slots: [slot], prologue: { id: "scene", blocks: [] }, beats: [] },
  { ...base, mode: "time-trial", timeLimitMs: 60000, slots: [{ ...slot, questionType: "queens" }] },
];
export const competitiveRoomContext: GameRoomContext = {
  roomId: "tabarnia-room",
  roomTitle: "Tabarnia",
  returnTo: "/salas/tabarnia-room",
  memberId: "player",
  availabilityStatus: "available",
  attemptStatus: "available",
};
export const socialSnapshot: FlashPopSocialSnapshot = {
  currentPlayer: { id: "player", displayName: "Kike", initials: "KI", tone: "social" },
  players: [],
  peers: [],
};
export const competitivePageModel: CompetitiveChallengePageModel = {
  challenge: competitiveFlash,
  roomContext: competitiveRoomContext,
  gameplayPersistence: "server",
  socialSnapshot,
};
export const publicMiniWordle: ServerMiniWordleQuestion = {
  id: "wordle",
  type: "mini-wordle",
  category: "Test",
  tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [] },
  question: "Descubre la palabra",
  timeLimit: 60,
  points: 100,
  hint: "Una pista pública",
  wordLength: 5,
  maxAttempts: 4,
  progress: { kind: "mini-wordle", guesses: [], feedback: [], attemptsUsed: 0, maxAttempts: 4 },
};
