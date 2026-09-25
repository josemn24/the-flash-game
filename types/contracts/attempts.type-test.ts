import type {
  CompleteAttemptInput,
  StartAttemptInput,
  SubmitAnswerInput,
  TakeOverAttemptInput,
} from "./attempts";

type Assert<T extends true> = T;
type NoAuthority<T> =
  Extract<
    keyof T,
    | "playerId"
    | "authUserId"
    | "presentedAt"
    | "submittedAt"
    | "deadlineAt"
    | "timeUsedMs"
    | "points"
    | "score"
    | "status"
  > extends never
    ? true
    : false;
export type StartHasNoCallerAuthority = Assert<NoAuthority<StartAttemptInput>>;
export type AnswerHasNoCallerAuthority = Assert<NoAuthority<SubmitAnswerInput>>;
export type CompleteHasNoCallerAuthority = Assert<NoAuthority<CompleteAttemptInput>>;
export type TakeoverHasNoCallerAuthority = Assert<NoAuthority<TakeOverAttemptInput>>;
export type TelemetryIsOptional = Assert<
  Partial<SubmitAnswerInput> extends Pick<SubmitAnswerInput, "clientTimeUsedMs"> ? true : false
>;
