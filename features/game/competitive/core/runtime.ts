import type { CommandData } from "./commandExecutor";
import type { AuthoritativeSessionUpdate } from "@/types/gameplay/authoritative-session";
import type { ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type {
  FeedbackChannel,
  Operation,
  PendingCommand,
  SessionEvent,
  SessionState,
} from "./sessionReducer";
import type { CompetitiveChallenge, ModePolicy } from "../modes/policy";
export type CommandStep = {
  accept: (
    response: AuthoritativeSessionUpdate,
    command: PendingCommand,
    review?: readonly ServerFlashTerminalReview[],
  ) => void;
  after?: () => Promise<void>;
  channel?: FeedbackChannel;
};
export type SessionRuntime = {
  challenge: CompetitiveChallenge;
  policy: ModePolicy;
  state: () => SessionState;
  commit: (event: SessionEvent) => void;
  run: <K extends Operation>(
    operation: K,
    data: CommandData<K>,
    step: CommandStep,
  ) => Promise<boolean>;
  schedule: (name: string, delay: number, callback: () => void) => void;
  cancel: (name: string) => void;
  cancelAll: () => void;
  refresh: () => void;
  now: () => number;
};
