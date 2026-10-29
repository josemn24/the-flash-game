import type { GameSessionAcceptance, SessionAcceptanceByOperation } from "./authoritative-session";
import type { GameSessionOperation } from "@/types/contracts/game-session";
type Assert<T extends true> = T;
export type EveryOperationHasResult = Assert<
  GameSessionOperation extends keyof SessionAcceptanceByOperation ? true : false
>;
export type CompletedScoreRequired = Assert<
  undefined extends GameSessionAcceptance<"complete">["state"]["score"] ? false : true
>;
export type EvaluatedPointsRequired = Assert<
  undefined extends GameSessionAcceptance<"answer">["state"]["points"] ? false : true
>;
export type PreparedPayloadRequired = Assert<
  object extends Pick<GameSessionAcceptance<"prepare">["state"], "publicPayload"> ? false : true
>;
export const missingScore: GameSessionAcceptance<"complete"> = {
  kind: "accepted",
  operation: "complete",
  effect: "completed",
  // @ts-expect-error A completed session requires its authoritative score and identity.
  state: { phase: "results" },
};
export const wrongOperation: GameSessionAcceptance<"answer"> = {
  kind: "accepted",
  // @ts-expect-error The operation cannot be substituted independently of the result.
  operation: "complete",
  effect: "evaluated",
  state: {
    sessionId: "a",
    revision: 1,
    challengeItemId: "i",
    status: "correct",
    points: 1,
    timeUsedMs: 1,
  },
};

type TrialPrepared = import("./authoritative-session").TimeTrialSessionAcceptance<"prepare">;
export type TrialClockRequired = Assert<
  undefined extends TrialPrepared["state"]["timeTrial"] ? false : true
>;
export type TrialActiveDeadlineRequired = Assert<
  null extends TrialPrepared["state"]["timeTrial"]["deadlineAt"] ? false : true
>;
export type HashtagCorrectCellsRequired = Assert<
  undefined extends GameSessionAcceptance<"wordHashtagSwap">["state"]["correctCells"] ? false : true
>;
export const missingTrialClock: TrialPrepared = {
  kind: "accepted",
  operation: "prepare",
  effect: "acknowledged",
  // @ts-expect-error An active Time Trial preparation must include a running global clock.
  state: {
    sessionId: "s",
    revision: 2,
    challengeItemId: "i",
    publicPayload: {},
    presentedAt: null,
    deadlineAt: null,
    timedOut: false,
  },
};

type TrialProvider = import("@/application/ports/game-session").GameSessionProvider<"time-trial">;
type TrialProviderPrepared = Extract<
  Awaited<ReturnType<TrialProvider["execute"]>>,
  { operation: "prepare" }
>;
export type TrialPortRequiresClock = Assert<
  undefined extends TrialProviderPrepared["state"]["timeTrial"] ? false : true
>;
export type TrialPortRequiresActiveDeadline = Assert<
  null extends TrialProviderPrepared["state"]["timeTrial"]["deadlineAt"] ? false : true
>;
