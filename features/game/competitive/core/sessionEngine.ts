import { formatFailure } from "../formats/failure";
import {
  GameSessionCommandError,
  type GameSessionProvider,
  type SessionClock,
} from "@/application/ports/game-session";
import type {
  GameSessionBootstrap,
  GameSessionResult,
} from "@/types/gameplay/authoritative-session";
import { systemSessionClock } from "../../session/clock";
import { createSessionCommandId } from "../../session/commandId";
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
import { PhaseTimers } from "./phaseTimers";
import { createAttemptLifecycle } from "./attemptLifecycle";
import { createInteractions } from "./interactions";
import type { CommandOrigin, CommandStep, SessionRuntime } from "./runtime";
import {
  afterCommandRecovery,
  classifyCommandFailure,
  commandRetryPlan,
  retryReaction,
} from "./commandRecoveryPolicy";
import type { FinalizationCheckpoint, FinalizationDecision } from "../modes/finalization";

export type SessionOptions = {
  challenge: CompetitiveChallenge;
  initialSession: GameSessionBootstrap;
  provider: GameSessionProvider;
  clock?: SessionClock;
  refresh?: () => void;
};
type CommandExecution = {
  readonly command: PendingCommand;
  readonly generation: number;
  readonly token: symbol;
};

/** Owns the snapshot, pending command and effect lifetime. React only subscribes. */
export class CompetitiveSessionEngine {
  private snapshot: SessionState;
  private listeners = new Set<() => void>();
  private timers: PhaseTimers;
  private readonly clock: SessionClock;
  private executor: CommandExecutor;
  private pendingStep?: CommandStep;
  private active = true;
  private generation = 0;
  private connections = 0;
  private recoveryStarted = false;
  private reconciling = false;
  private retryAt = 0;
  private automaticRetries = 0;
  private alphabetPassExpired = false;
  private abortController = new AbortController();
  private retryExecution?: CommandExecution;
  private deferredRetry?: CommandExecution;
  private statusOwner?: CommandExecution;
  private retryTimerOwner?: CommandExecution;
  private terminalRecoveryAttempted = false;
  private terminalRecoveryRequested = false;
  private refresh: () => void;
  readonly policy;
  readonly lifecycle;
  readonly interactions;
  constructor(readonly options: SessionOptions) {
    const { challenge, initialSession } = options;
    const terminalReview = initialSession.review;
    this.clock = options.clock ?? systemSessionClock;
    this.timers = new PhaseTimers(this.clock);
    this.policy = createModePolicy(challenge);
    this.refresh = options.refresh ?? (() => {});
    this.snapshot = initialSessionState(
      initialSession.status === "completed"
        ? "results"
        : initialSession.status === "inProgress"
          ? "recovering"
          : "intro",
      [...initialSession.results],
      initialSession.score,
      terminalReview?.length ? reviewFor(challenge, terminalReview) : null,
    );
    if (initialSession.timeTrial) this.snapshot.timeTrial = initialSession.timeTrial;
    if (initialSession.status === "completed" && !terminalReview?.length) {
      this.snapshot.lifecycleError = {
        operation: "projection",
        code: "review_pending",
        message: "Revisión temporalmente no disponible. Puedes volver a cargarla.",
      };
    }
    this.executor = new CommandExecutor(
      options.provider,
      () => this.snapshot.attempt,
      () => this.snapshot.pendingCommand,
      this.abortController.signal,
    );
    const runtime: SessionRuntime = {
      challenge,
      policy: this.policy,
      state: this.getSnapshot,
      commit: this.commit,
      run: this.run,
      runDeadline: this.runDeadline,
      runOvertakingDraft: this.runOvertakingDraft,
      refresh: this.refresh,
      now: () => this.clock.now(),
      schedule: (name, delay, callback) =>
        this.timers.schedule(name, delay, () => {
          if (this.active) callback();
        }),
      cancel: (name) => this.timers.cancel(name),
      cancelAll: () => this.clearTimers(),
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
    if (this.options.initialSession.status === "inProgress" && !this.recoveryStarted) {
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
    this.abortController.abort();
    this.generation++;
    this.clearTimers();
    this.listeners.clear();
  };
  private execution(command: PendingCommand): CommandExecution {
    return { command, generation: this.generation, token: Symbol(command.operation) };
  }
  private isCurrent(generation: number) {
    return this.active && generation === this.generation;
  }
  private clearTimers() {
    this.statusOwner = undefined;
    this.retryTimerOwner = undefined;
    this.deferredRetry = undefined;
    this.timers.clear();
  }
  private cancelRetry() {
    this.retryTimerOwner = undefined;
    this.timers.cancel("completion-retry");
  }
  private scheduleRetry(command: PendingCommand, delay: number) {
    const owner = this.execution(command);
    this.retryTimerOwner = owner;
    this.timers.schedule("completion-retry", delay, () => {
      if (
        this.retryTimerOwner?.token !== owner.token ||
        !this.isCurrent(owner.generation) ||
        this.snapshot.pendingCommand !== command
      )
        return;
      this.retryTimerOwner = undefined;
      void this.retry(true);
    });
  }
  private send = async <K extends Operation>(
    command: PendingCommand<K>,
    invoke: () => Promise<GameSessionResult<K>>,
    step: CommandStep<K>,
  ): Promise<boolean> => {
    if (!this.active || this.snapshot.lifecycleError?.recoveryAction === "refresh") return false;
    const draftItemId =
      command.operation === "queensDraft" || command.operation === "connectPairsDraft"
        ? (command.input as { challengeItemId: string }).challengeItemId
        : null;
    if (
      this.snapshot.phase !== "playing" &&
      (command.operation === "queensDraft" || command.operation === "connectPairsDraft")
    )
      return false;
    if (draftItemId !== null && this.snapshot.question?.id !== draftItemId) return false;
    const execution = this.execution(command);
    const { generation } = execution;
    this.pendingStep = step;
    this.commit({ type: "command_started", command, feedback: step.channel });
    this.statusOwner = execution;
    this.timers.cancel("status");
    if (step.channel)
      this.timers.schedule("status", 250, () => {
        if (
          this.statusOwner?.token === execution.token &&
          this.isCurrent(generation) &&
          this.snapshot.pendingCommand === command
        )
          this.commit({ type: "feedback_visible" });
      });
    try {
      const result = await invoke();
      if (result.kind !== "accepted") throw new GameSessionCommandError(result);
      if (result.operation !== command.operation)
        throw new GameSessionCommandError({
          kind: "uncertain",
          code: "invalid_backend_response",
          retryable: true,
        });
      const response = result.state;
      if (!this.active || generation !== this.generation) return false;
      const attemptId =
        command.operation === "start" || command.operation === "takeover"
          ? response.sessionId
          : this.snapshot.attempt?.id;
      const revision =
        response.revision === undefined
          ? this.snapshot.attempt?.revision
          : Number(response.revision);
      if (
        command.operation !== "abandon" &&
        command.operation !== "prepareSession" &&
        (!attemptId || !Number.isSafeInteger(revision))
      )
        throw new Error("invalid_attempt_response");
      if (this.options.challenge.mode === "time-trial" && response.timeTrial)
        this.commit({ type: "time_trial", progress: response.timeTrial, now: this.clock.now() });
      step.accept(response, command, result.review);
      this.commit({
        type: "command_succeeded",
        attempt: attemptId ? { id: attemptId, revision: revision! } : null,
      });
      this.pendingStep = undefined;
      this.retryAt = 0;
      this.automaticRetries = 0;
      this.cancelRetry();
      return true;
    } catch (error) {
      if (!this.active || generation !== this.generation) return false;
      if (
        command.operation === "start" &&
        error instanceof GameSessionCommandError &&
        error.failure.code === "attempt_control_required"
      ) {
        const control = error.failure.controlRequired;
        if (control) {
          this.pendingStep = undefined;
          this.commit({
            type: "control_required",
            transfer: {
              sessionId: control.sessionId,
              revision: control.revision,
              deadlineAt: control.deadlineAt,
              challengeId: this.options.challenge.id,
              idempotencyKey: createSessionCommandId("takeover"),
            },
          });
          return false;
        }
      }
      await this.failed(command, step, error);
      return false;
    } finally {
      if (this.statusOwner?.token === execution.token) {
        this.statusOwner = undefined;
        this.timers.cancel("status");
      }
    }
  };
  private run = async <K extends Operation>(
    operation: K,
    data: CommandData<K>,
    step: CommandStep<K>,
  ): Promise<boolean> => {
    if (!this.active || this.snapshot.lifecycleError?.recoveryAction === "refresh") return false;
    const generation = this.generation;
    let accepted = false;
    if (!this.snapshot.pendingCommand) {
      this.automaticRetries = 0;
      this.cancelRetry();
    }
    try {
      await this.executor.execute(operation, data, async (command, invoke) => {
        accepted = await this.send(command, invoke, step);
      });
    } catch (error) {
      if (!(error instanceof PendingCommandBlocked)) throw error;
    }
    await this.afterCommand("run", operation, accepted, step, generation);
    return accepted;
  };
  private runOvertakingDraft = async <K extends Operation>(
    operation: K,
    data: CommandData<K>,
    step: CommandStep<K>,
  ): Promise<boolean> => {
    if (!this.active || this.snapshot.lifecycleError?.recoveryAction === "refresh") return false;
    const pending = this.snapshot.pendingCommand;
    if (pending && pending.operation !== "queensDraft" && pending.operation !== "connectPairsDraft")
      return false;
    // Retire every browser-side effect owned by the old checkpoint, including
    // its retry. A late finally must not clear a newer execution's state.
    const generation = ++this.generation;
    this.retryExecution = undefined;
    this.deferredRetry = undefined;
    this.statusOwner = undefined;
    this.timers.cancel("status");
    this.cancelRetry();
    this.retryAt = 0;
    this.automaticRetries = 0;
    if (pending) {
      this.pendingStep = undefined;
      this.commit({
        type: "command_failed",
        definitive: true,
        phase: this.snapshot.phase,
        locked: true,
      });
    }
    let accepted = false;
    try {
      await this.executor.executeImmediate(operation, data, async (command, invoke) => {
        accepted = await this.send(command, invoke, step);
      });
    } catch (error) {
      if (!(error instanceof PendingCommandBlocked)) throw error;
    }
    await this.afterCommand("run", operation, accepted, step, generation);
    return accepted;
  };
  private runDeadline = this.runOvertakingDraft;
  private async afterCommand(
    origin: CommandOrigin,
    operation: Operation,
    accepted: boolean,
    step: CommandStep,
    generation: number,
  ) {
    if (!this.isCurrent(generation)) return;
    if (origin !== "takeover") await this.recoverTerminalIfRequested();
    if (!this.isCurrent(generation)) return;
    const decide = (checkpoint: FinalizationCheckpoint) =>
      this.policy.finalization.afterCommand(checkpoint, {
        origin,
        operation,
        accepted,
        state: this.snapshot,
        requested: this.lifecycle.finalizationRequested(),
        reconciling: this.reconciling,
        expiredPass: this.alphabetPassExpired,
      });
    const before = decide("before-after");
    if (before.type === "finalize") {
      this.alphabetPassExpired = false;
      await this.applyFinalization(before);
      return;
    }
    if (accepted) await step.after?.();
    if (!this.isCurrent(generation)) return;
    // Each awaited effect may run nested commands. Always decide from the live snapshot.
    await this.applyFinalization(decide("after-after"));
    if (!this.isCurrent(generation)) return;
    await this.applyFinalization(decide("after-finalize"));
    if (!this.isCurrent(generation)) return;
    if (
      afterCommandRecovery({
        origin,
        accepted,
        code: this.snapshot.lifecycleError?.code,
        reconciling: this.reconciling,
      }) === "reconcile"
    )
      await this.reconcile();
    if (this.isCurrent(generation)) await this.applyFinalization(decide("after-reconcile"));
  }
  private async applyFinalization(decision: FinalizationDecision) {
    if (decision.type === "finalize") {
      if (decision.clearPending)
        this.commit({
          type: "command_failed",
          definitive: true,
          phase: "finalizing",
          locked: true,
        });
      await this.lifecycle.finalizeGlobalClock();
    } else if (decision.type === "reconcile") {
      if (decision.resetRetryDelay) this.retryAt = 0;
      await this.reconcile();
    }
  }
  private async failed(command: PendingCommand, step: CommandStep, error: unknown) {
    const code = error instanceof GameSessionCommandError ? error.failure.code : undefined;
    if (this.policy.finalization.onFailure(command.operation, code) === "expired-pass") {
      this.alphabetPassExpired = true;
      this.pendingStep = undefined;
      this.retryAt = 0;
      this.automaticRetries = 0;
      this.cancelRetry();
      this.commit({
        type: "command_failed",
        definitive: true,
        phase: "finalizing",
        locked: true,
      });
      return;
    }
    const isCheckpoint =
      command.operation === "queensDraft" || command.operation === "connectPairsDraft";
    const checkpointFailure = error instanceof GameSessionCommandError ? error.failure : undefined;
    const retryFinalization =
      command.operation === "complete" &&
      this.options.challenge.mode === "time-trial" &&
      this.snapshot.phase === "finalizing" &&
      checkpointFailure?.retryable !== false &&
      !checkpointFailure?.authorizationLost &&
      !["session_transferred", "attempt_terminal", "attempt_session_missing"].includes(code ?? "");
    if (
      isCheckpoint &&
      code !== "stale_version" &&
      !checkpointFailure?.authorizationLost &&
      ![
        "session_transferred",
        "attempt_inactivity_expired",
        "attempt_terminal",
        "attempt_session_missing",
      ].includes(code ?? "") &&
      checkpointFailure?.retryable !== false
    ) {
      const retry = commandRetryPlan({
        operation: command.operation,
        failure: checkpointFailure,
        definitive: false,
        automaticRetries: this.automaticRetries,
        now: this.clock.now(),
        retryUntilAccepted: true,
      });
      this.retryAt = retry.retryAt;
      // A draft checkpoint is best-effort: keep the local board editable and
      // retain the exact command for idempotent replay without surfacing a
      // lifecycle error or submission feedback.
      this.commit({ type: "command_failed", definitive: false, locked: this.snapshot.locked });
      this.automaticRetries++;
      this.commit({ type: "completion_retry", scheduled: true });
      this.scheduleRetry(command, retry.delayMs ?? 30_000);
      return;
    }
    if (
      isCheckpoint &&
      code !== "stale_version" &&
      !checkpointFailure?.authorizationLost &&
      checkpointFailure?.retryable === false &&
      ![
        "session_transferred",
        "attempt_inactivity_expired",
        "attempt_terminal",
        "attempt_session_missing",
      ].includes(code ?? "")
    ) {
      this.pendingStep = undefined;
      this.retryAt = 0;
      this.automaticRetries = 0;
      this.cancelRetry();
      this.commit({ type: "command_failed", definitive: true, locked: this.snapshot.locked });
      return;
    }
    if (retryFinalization) {
      const retry = commandRetryPlan({
        operation: command.operation,
        failure: checkpointFailure,
        definitive: false,
        automaticRetries: this.automaticRetries,
        now: this.clock.now(),
        retryUntilAccepted: true,
      });
      this.retryAt = retry.retryAt;
      this.commit({ type: "command_failed", definitive: false, locked: true });
      this.automaticRetries++;
      this.commit({ type: "completion_retry", scheduled: true });
      this.scheduleRetry(command, retry.delayMs ?? 30_000);
      return;
    }
    const { action, takeoverUncertain } = classifyCommandFailure({
      operation: command.operation,
      mode: this.options.challenge.mode,
      failure: error instanceof GameSessionCommandError ? error.failure : undefined,
      hasAttempt: this.snapshot.attempt !== null,
      terminalRecoveryAttempted: this.terminalRecoveryAttempted,
      automaticRetries: this.automaticRetries,
      now: this.clock.now(),
    });
    if (action.type === "takeover-conflict") {
      console.info(JSON.stringify({ event: "takeover_conflict", code }));
      this.clearTimers();
      this.pendingStep = undefined;
      this.commit({
        type: "command_failed",
        definitive: true,
        lifecycleError: {
          operation: "takeover",
          code,
          retryable: false,
          message: "La partida ha cambiado en otro dispositivo. Vuelve a comprobar su estado.",
        },
        notice: "La partida ha cambiado en otro dispositivo. Vuelve a comprobar su estado.",
      });
      return;
    }
    if (takeoverUncertain) console.info(JSON.stringify({ event: "takeover_uncertain" }));
    if (action.type === "session-transferred") {
      this.clearTimers();
      this.pendingStep = undefined;
      this.terminalRecoveryRequested = false;
      this.commit({
        type: "authorization_lost",
        error: {
          operation: command.operation,
          code,
          retryable: false,
          message: "Has continuado esta partida en otro dispositivo.",
        },
      });
      console.info(JSON.stringify({ event: "session_transferred", operation: command.operation }));
      return;
    }
    if (action.type === "authorization-lost") {
      this.clearTimers();
      this.pendingStep = undefined;
      if (action.recoverTerminal) {
        this.terminalRecoveryAttempted = true;
        this.commit({
          type: "command_failed",
          definitive: true,
          lifecycleError: {
            operation: command.operation,
            code,
            retryable: false,
            message: "Comprobando el estado final de la partida.",
          },
        });
        this.terminalRecoveryRequested = true;
        return;
      }
      this.commit({
        type: "authorization_lost",
        error: {
          operation: command.operation,
          code,
          retryable: false,
          message: "Ya no tienes permiso para continuar esta partida.",
        },
      });
      return;
    }
    if (action.type === "expired") {
      this.clearTimers();
      this.pendingStep = undefined;
      this.commit({ type: "expired" });
      return;
    }
    if (action.type === "reload-projection") {
      this.clearTimers();
      this.pendingStep = undefined;
      this.retryAt = 0;
      this.automaticRetries = 0;
      this.commit({ type: "completion_retry", scheduled: false });
      this.commit({
        type: "command_failed",
        definitive: true,
        locked: true,
        lifecycleError: {
          operation: "projection",
          code,
          recoveryAction: "refresh",
          retryable: false,
          message: formatFailure(command.operation, code, action).message,
        },
      });
      if (action.automatic) this.refresh();
      return;
    }
    const { retry, lifecycle, definitive } = action;
    const { message, feedback } = formatFailure(command.operation, code, action, step.channel);
    this.retryAt = retry.retryAt;
    this.commit({
      type: "command_failed",
      definitive,
      lifecycleError: lifecycle
        ? { operation: command.operation, code, message, retryAt: this.retryAt || undefined }
        : undefined,
      feedback,
      notice: lifecycle ? message : undefined,
    });
    if (definitive) this.pendingStep = undefined;
    if (retry.retryable) {
      // Fixed fields only: never log the command, answer, identifiers or tokens.
      console.info(
        JSON.stringify({
          event: "competitive_command_uncertain",
          operation: command.operation,
          retry: this.automaticRetries,
        }),
      );
    }
    if (retry.delayMs !== undefined) {
      this.automaticRetries++;
      this.commit({ type: "completion_retry", scheduled: true });
      this.scheduleRetry(command, retry.delayMs);
    }
  }

  private async recoverTerminalIfRequested() {
    if (!this.terminalRecoveryRequested || !this.active) return false;
    this.terminalRecoveryRequested = false;
    if (await this.lifecycle.recoverTerminal()) return true;
    this.clearTimers();
    this.pendingStep = undefined;
    this.commit({
      type: "authorization_lost",
      error: {
        operation: "recover",
        code: "attempt_session_missing",
        retryable: false,
        message: "Ya no tienes permiso para continuar esta partida.",
      },
    });
    return false;
  }

  retry = async (automatic = false) => {
    // React handlers can pass an event; only our internal true means an automatic replay.
    automatic = automatic === true;
    if (!this.active || this.clock.now() < this.retryAt) return;
    const running = this.retryExecution;
    if (
      running &&
      this.isCurrent(running.generation) &&
      running.command === this.snapshot.pendingCommand
    ) {
      if (automatic) this.deferredRetry = running;
      return;
    }
    if (this.snapshot.busy) return;
    if (this.snapshot.lifecycleError?.recoveryAction === "refresh") {
      if (!automatic) this.refresh();
      return;
    }
    if (this.snapshot.lifecycleError?.retryable === false) return;
    if (!automatic) {
      this.automaticRetries = 0;
      this.cancelRetry();
      this.commit({ type: "completion_retry", scheduled: false });
    }
    const reaction = retryReaction(this.snapshot);
    if (reaction === "reload-result") {
      await this.lifecycle.reloadResult();
      return;
    }
    if (reaction === "refresh") {
      this.refresh();
      return;
    }
    if (reaction === "reconcile") {
      await this.reconcile();
      return;
    }
    const command = this.snapshot.pendingCommand;
    const step = this.pendingStep;
    if (!command || !step) return;
    const execution = this.execution(command);
    this.retryExecution = execution;
    console.info(
      JSON.stringify({
        event: "competitive_command_replay",
        operation: command.operation,
        automatic,
      }),
    );
    let accepted = false;
    try {
      await this.executor.retry(command, async (original, invoke) => {
        accepted = await this.send(original, invoke, step);
      });
    } catch (error) {
      if (!(error instanceof PendingCommandBlocked)) throw error;
    } finally {
      if (this.retryExecution?.token === execution.token) this.retryExecution = undefined;
    }
    await this.afterCommand("retry", command.operation, accepted, step, execution.generation);
    if (this.deferredRetry?.token === execution.token) {
      this.deferredRetry = undefined;
      if (
        this.isCurrent(execution.generation) &&
        this.snapshot.pendingCommand === command &&
        !this.retryTimerOwner
      )
        this.scheduleRetry(command, Math.max(0, this.retryAt - this.clock.now()));
    }
  };
  reconcile = async () => {
    if (
      this.reconciling ||
      !this.active ||
      this.snapshot.busy ||
      this.snapshot.lifecycleError?.retryable === false ||
      this.clock.now() < this.retryAt
    )
      return;
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
    if (this.options.challenge.mode === "time-trial") {
      await this.lifecycle.startTimeTrial();
      return;
    }
    if (this.options.challenge.mode === "pyramid")
      this.commit({ type: "phase", phase: "preparing", clearQuestion: true });
    await this.lifecycle.prepare();
  };
  takeOver = async () => {
    const transfer = this.snapshot.transfer;
    if (!this.active || !transfer || this.snapshot.busy || this.snapshot.pendingCommand)
      return false;
    const generation = this.generation;
    let accepted = false;
    const step: CommandStep = {
      accept: () => {},
      after: async () => {
        await this.lifecycle.recoverTransferred();
      },
    };
    console.info(JSON.stringify({ event: "takeover_requested" }));
    try {
      await this.executor.executeInput(
        "takeover",
        {
          sessionId: transfer.sessionId,
          challengeId: transfer.challengeId,
          revision: transfer.revision,
          idempotencyKey: transfer.idempotencyKey,
        },
        async (command, invoke) => {
          accepted = await this.send(command, invoke, step);
        },
      );
    } catch (error) {
      if (!(error instanceof PendingCommandBlocked)) throw error;
    }
    await this.afterCommand("takeover", "takeover", accepted, step, generation);
    return accepted;
  };
  cancelTakeOver = () => {
    if (!this.snapshot.transfer || this.snapshot.busy) return;
    this.commit({ type: "control_cancelled" });
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
          this.clearTimers();
          this.refresh();
        },
      },
    );
  };
}
