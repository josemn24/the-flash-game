import type { GameRoomContext } from "@/types/view-models/room";
import type { ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import { createCompetitiveAttemptClient, type CompetitiveAttemptClient } from "../attemptClient";
import { CompetitiveCommandError, type CompetitiveJsonObject } from "../transport";
import { createModePolicy, reviewFor, type CompetitiveChallenge } from "../modes/policy";
import { CommandExecutor, PendingCommandBlocked, type CommandData } from "./commandExecutor";
import {
  initialSessionState,
  sessionReducer,
  type Operation,
  type SessionEvent,
  type SessionState,
  type PendingCommand,
} from "./sessionReducer";
import { initialResults } from "./projection";
import { PhaseTimers } from "./phaseTimers";
import { createAttemptLifecycle } from "./attemptLifecycle";
import { createInteractions } from "./interactions";
import type { CommandStep, SessionRuntime } from "./runtime";
import { formatFailure } from "../formats/failure";

const lifecycleOperations = new Set<Operation>([
  "start",
  "recover",
  "prepare",
  "activate",
  "complete",
  "abandon",
  "alphabetPass",
  "queensDraft",
]);
export type SessionOptions = {
  challenge: CompetitiveChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
  client?: CompetitiveAttemptClient;
  refresh?: () => void;
};
/** Owns the snapshot, pending command and effect lifetime. React only subscribes. */
export class CompetitiveSessionEngine {
  private snapshot: SessionState;
  private listeners = new Set<() => void>();
  private timers = new PhaseTimers();
  private executor: CommandExecutor;
  private pendingStep?: CommandStep;
  private active = true;
  private generation = 0;
  private connections = 0;
  private recoveryStarted = false;
  private reconciling = false;
  private retryAt = 0;
  private completionRetries = 0;
  private retrying = false;
  private refresh: () => void;
  readonly policy;
  readonly lifecycle;
  readonly interactions;
  constructor(readonly options: SessionOptions) {
    const { challenge, roomContext, terminalReview } = options;
    this.policy = createModePolicy(challenge);
    this.refresh = options.refresh ?? (() => {});
    this.snapshot = initialSessionState(
      roomContext.result
        ? "results"
        : roomContext.attemptStatus === "inProgress"
          ? "recovering"
          : "intro",
      initialResults(roomContext),
      roomContext.result?.flashPoints ?? 0,
      terminalReview?.length ? reviewFor(challenge, terminalReview) : null,
    );
    this.executor = new CommandExecutor(
      options.client ?? createCompetitiveAttemptClient(),
      () => this.snapshot.attempt,
      () => this.snapshot.pendingCommand,
    );
    const runtime: SessionRuntime = {
      challenge,
      policy: this.policy,
      state: this.getSnapshot,
      commit: this.commit,
      run: this.run,
      refresh: this.refresh,
      schedule: (name, delay, callback) =>
        this.timers.schedule(name, delay, () => {
          if (this.active) callback();
        }),
      cancel: (name) => this.timers.cancel(name),
      cancelAll: () => this.timers.clear(),
    };
    this.lifecycle = createAttemptLifecycle(runtime);
    this.interactions = createInteractions(runtime, this.lifecycle);
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private commit = (event: SessionEvent) => {
    if (!this.active) return;
    this.snapshot = sessionReducer(this.snapshot, event);
    this.listeners.forEach((listener) => listener());
  };
  connect = () => {
    this.connections++;
    if (this.options.roomContext.attemptStatus === "inProgress" && !this.recoveryStarted) {
      this.recoveryStarted = true;
      void this.lifecycle.recover();
    }
    return () => {
      this.connections--;
      // StrictMode replays setup synchronously; a real detach invalidates effects.
      queueMicrotask(() => {
        if (this.connections === 0) this.dispose();
      });
    };
  };
  dispose = () => {
    this.active = false;
    this.generation++;
    this.timers.clear();
    this.listeners.clear();
  };
  private send = async (
    command: PendingCommand,
    invoke: () => Promise<CompetitiveJsonObject>,
    step: CommandStep,
  ): Promise<boolean> => {
    if (!this.active) return false;
    const generation = this.generation;
    this.pendingStep = step;
    this.commit({ type: "command_started", command, feedback: step.channel });
    if (step.channel)
      this.timers.schedule("status", 250, () => this.commit({ type: "feedback_visible" }));
    try {
      const response = await invoke();
      if (!this.active || generation !== this.generation) return false;
      const attemptId =
        command.operation === "start" ? String(response.attemptId) : this.snapshot.attempt?.id;
      const lockVersion =
        response.lockVersion === undefined
          ? this.snapshot.attempt?.lockVersion
          : Number(response.lockVersion);
      if (command.operation !== "abandon" && (!attemptId || !Number.isSafeInteger(lockVersion)))
        throw new Error("invalid_attempt_response");
      step.accept(response, command);
      this.commit({
        type: "command_succeeded",
        attempt: attemptId ? { id: attemptId, lockVersion: lockVersion! } : null,
      });
      this.pendingStep = undefined;
      this.retryAt = 0;
      return true;
    } catch (error) {
      if (!this.active || generation !== this.generation) return false;
      this.failed(command, step, error);
      return false;
    } finally {
      if (this.active) this.timers.cancel("status");
    }
  };
  private run = async <K extends Operation>(
    operation: K,
    data: CommandData<K>,
    step: CommandStep,
  ): Promise<boolean> => {
    let accepted = false;
    try {
      await this.executor.execute(operation, data, async (command, invoke) => {
        accepted = await this.send(command, invoke, step);
      });
    } catch (error) {
      if (!(error instanceof PendingCommandBlocked)) throw error;
    }
    if (accepted && this.active) await step.after?.();
    if (!accepted && this.snapshot.lifecycleError?.code === "stale_version" && !this.reconciling)
      await this.reconcile();
    if (
      !accepted &&
      this.options.challenge.mode === "alphabet" &&
      this.lifecycle.finalizationRequested() &&
      (operation === "answer" || operation === "alphabetPass" || operation === "prepare") &&
      !this.reconciling &&
      this.snapshot.pendingCommand
    ) {
      // Recovery preserves any receipt already accepted by the server. A rejected
      // player action must not hold the timeout behind the interactive limiter.
      this.retryAt = 0;
      await this.reconcile();
    }
    return accepted;
  };
  private failed(command: PendingCommand, step: CommandStep, error: unknown) {
    const code = error instanceof CompetitiveCommandError ? error.code : undefined;
    if (code === "attempt_inactivity_expired") {
      this.timers.clear();
      this.pendingStep = undefined;
      this.commit({ type: "expired" });
      return;
    }
    if (
      (command.operation === "complete" ||
        command.operation === "recover" ||
        command.operation === "start") &&
      (code === "attempt_session_missing" || code === "attempt_terminal")
    ) {
      this.refresh();
      this.commit({
        type: "command_failed",
        lifecycleError: {
          operation: "projection",
          code,
          message: "Comprobando el resultado guardado. Puedes volver a cargarlo.",
        },
      });
      return;
    }
    const seconds =
      error instanceof CompetitiveCommandError &&
      (error.status === 429 || code === "alphabet_deadline_not_reached")
        ? Math.max(1, error.retryAfterSeconds ?? 1)
        : undefined;
    this.retryAt = seconds === undefined ? 0 : Date.now() + seconds * 1000;
    const failure = formatFailure(command.operation, code, step.channel);
    const message =
      code === "alphabet_deadline_not_reached"
        ? "Esperando a que termine el tiempo de la partida."
        : seconds !== undefined
          ? `Demasiadas solicitudes. Espera ${seconds} ${seconds === 1 ? "segundo" : "segundos"} antes de volver a intentarlo.`
          : failure.message;
    const lifecycle =
      lifecycleOperations.has(command.operation) ||
      code === "stale_version" ||
      this.options.challenge.mode === "alphabet";
    this.commit({
      type: "command_failed",
      definitive: failure.definitive,
      lifecycleError: lifecycle
        ? { operation: command.operation, code, message, retryAt: this.retryAt || undefined }
        : undefined,
      feedback: failure.feedback ? { ...failure.feedback, message } : undefined,
      notice: lifecycle ? message : undefined,
    });
    if (failure.definitive) this.pendingStep = undefined;
    const retryable =
      !(error instanceof CompetitiveCommandError) ||
      error.status >= 500 ||
      error.status === 429 ||
      code === "alphabet_deadline_not_reached";
    if (
      this.options.challenge.mode === "alphabet" &&
      this.lifecycle.finalizationRequested() &&
      (command.operation === "complete" ||
        command.operation === "recover" ||
        command.operation === "start") &&
      retryable &&
      this.completionRetries < 3
    ) {
      const delay = seconds === undefined ? 1000 * 2 ** this.completionRetries : seconds * 1000;
      this.completionRetries++;
      this.commit({ type: "completion_retry", scheduled: true });
      this.timers.schedule("completion-retry", delay, () => {
        void this.retry(true);
      });
    }
  }
  retry = async (automatic = false) => {
    if (!this.active || this.snapshot.busy || this.retrying || Date.now() < this.retryAt) return;
    if (!automatic) {
      this.completionRetries = 0;
      this.timers.cancel("completion-retry");
      this.commit({ type: "completion_retry", scheduled: false });
    }
    if (this.snapshot.lifecycleError?.operation === "projection") {
      this.refresh();
      return;
    }
    if (this.snapshot.lifecycleError?.code === "stale_version") {
      await this.reconcile();
      return;
    }
    const command = this.snapshot.pendingCommand;
    const step = this.pendingStep;
    if (!command || !step) return;
    this.retrying = true;
    let accepted = false;
    try {
      await this.executor.retry(command, async (original, invoke) => {
        accepted = await this.send(original, invoke, step);
      });
    } finally {
      this.retrying = false;
    }
    if (accepted && this.active) await step.after?.();
    if (!accepted && this.snapshot.lifecycleError?.code === "stale_version") await this.reconcile();
  };
  reconcile = async () => {
    if (this.reconciling || !this.active || this.snapshot.busy || Date.now() < this.retryAt) return;
    this.reconciling = true;
    // The uncertain command is superseded only by a new authoritative recovery flow.
    this.commit({ type: "command_failed", definitive: true });
    this.pendingStep = undefined;
    try {
      await this.lifecycle.recover();
    } finally {
      this.reconciling = false;
    }
  };
  startQuestions = async () => {
    if (this.snapshot.pendingCommand) {
      await this.retry();
      return;
    }
    if (this.snapshot.busy) return;
    if (this.options.challenge.mode === "pyramid")
      this.commit({ type: "phase", phase: "preparing", clearQuestion: true });
    await this.lifecycle.prepare();
  };
  continueScene = async () => {
    if (this.snapshot.phase === "scene" && !this.snapshot.busy && !this.snapshot.pendingCommand)
      await this.lifecycle.next();
  };
  showReview = () => this.commit({ type: "phase", phase: "review" });
  showResults = () => this.commit({ type: "phase", phase: "results" });
  abandon = async () => {
    if (
      this.snapshot.busy ||
      !this.snapshot.attempt ||
      !window.confirm("¿Abandonar este intento? No podrás retomarlo.")
    )
      return;
    if (this.snapshot.pendingCommand) {
      await this.reconcile();
      return;
    }
    await this.run(
      "abandon",
      {},
      {
        accept: () => {
          this.timers.clear();
          this.refresh();
        },
      },
    );
  };
}
