import type {
  AttemptErrorCode,
  CompetitiveErrorReason,
  GameSessionErrorCode,
} from "./competitive-errors";

type Assert<T extends true> = T;
export type KnownAttemptCode = Assert<
  "survival_not_terminal" extends AttemptErrorCode ? true : false
>;
export type KnownSessionCode = Assert<
  "request_timeout" extends GameSessionErrorCode ? true : false
>;
export type RejectInventedCode = Assert<
  "invented_error" extends GameSessionErrorCode ? false : true
>;
// @ts-expect-error Every application code needs an explicit meaning.
export const incompleteMap: Record<AttemptErrorCode, CompetitiveErrorReason> = {
  stale_version: "conflict",
};
