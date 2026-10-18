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
import type { CommandStep, SessionRuntime } from "./runtime";
import { formatFailure } from "../formats/failure";

const lifecycleOperations = new Set<Operation>([
  "start",
  "prepareSession",
  "recover",
  "prepare",
  "activate",
  "complete",
  "abandon",
  "alphabetPass",
  "queensDraft",
  "takeover",
]);
export type SessionOptions = {
  challenge: CompetitiveChallenge;
  initialSession: GameSessionBootstrap;
  provider: GameSessionProvider;
  clock?: SessionClock;
  refresh?: () => void;
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
  private retrying = false;
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
      refresh: this.refresh,
      now: () => this.clock.now(),
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
    this.timers.clear();
    this.listeners.clear();
  };
  private send = async (
    command: PendingCommand,
    invoke: () => Promise<GameSessionResult>,
    step: CommandStep,
  ): Promise<boolean> => {
    if (!this.active) return false;
    const generation = this.generation;
    this.pendingStep = step;
    this.commit({ type: "command_started", command, feedback: step.channel });
    if (step.channel)
      this.timers.schedule("status", 250, () => this.commit({ type: "feedback_visible" }));
    try {
      const result = await invoke();
      if (result.kind !== "accepted") throw new GameSessionCommandError(result);
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
      this.timers.cancel("completion-retry");
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
      if (this.active) this.timers.cancel("status");
    }
  };
  private run = async <K extends Operation>(
    operation: K,
    data: CommandData<K>,
    step: CommandStep,
  ): Promise<boolean> => {
    let accepted = false;
    if (!this.snapshot.pendingCommand) {
      this.automaticRetries = 0;
      this.timers.cancel("completion-retry");
    }
    try {
      await this.executor.execute(operation, data, async (command, invoke) => {
        accepted = await this.send(command, invoke, step);
      });
    } catch (error) {
      if (!(error instanceof PendingCommandBlocked)) throw error;
    }
    await this.recoverTerminalIfRequested();
    if (!accepted && this.finalizeExpiredAlphabetPass()) {
      await this.lifecycle.finalizeAlphabet();
      return false;
    }
    if (accepted && this.active) await step.after?.();
    if (
      this.options.challenge.mode === "time-trial" &&
      operation !== "complete" &&
      operation !== "recover" &&
      this.lifecycle.finalizationRequested()
    )
      await this.lifecycle.finalizeAlphabet();
    if (
      !accepted &&
      this.options.challenge.mode === "time-trial" &&
      ["deadline_reached", "time_trial_terminal"].includes(this.snapshot.lifecycleError?.code ?? "")
    ) {
      this.commit({ type: "command_failed", definitive: true, phase: "finalizing", locked: true });
      await this.lifecycle.finalizeAlphabet();
    }
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
  private async failed(command: PendingCommand, step: CommandStep, error: unknown) {
    const code = error instanceof GameSessionCommandError ? error.failure.code : undefined;
    if (
      command.operation === "alphabetPass" &&
      this.options.challenge.mode === "alphabet" &&
      code === "pass_unavailable"
    ) {
      this.alphabetPassExpired = true;
      this.pendingStep = undefined;
      this.retryAt = 0;
      this.automaticRetries = 0;
      this.timers.cancel("completion-retry");
      this.commit({
        type: "command_failed",
        definitive: true,
        phase: "finalizing",
        locked: true,
      });
      return;
    }
    if (command.operation === "takeover") {
      if (code === "stale_version" || code === "idempotency_conflict") {
        console.info(JSON.stringify({ event: "takeover_conflict", code }));
        this.timers.clear();
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
      } else if (
        !(error instanceof GameSessionCommandError) ||
        error.failure.kind === "uncertain"
      ) {
        console.info(JSON.stringify({ event: "takeover_uncertain" }));
      }
    }
    if (code === "session_transferred") {
      this.timers.clear();
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
    if (
      [
        "not_authorized",
        "session_revoked",
        "competitive_access_denied",
        "auth_required",
        "unauthorized",
        "attempt_permission_revoked",
      ].includes(code ?? "") ||
      (error instanceof GameSessionCommandError &&
        error.failure.authorizationLost &&
        code !== "attempt_session_missing")
    ) {
      this.timers.clear();
      this.pendingStep = undefined;
      if (
        !this.terminalRecoveryAttempted &&
        command.operation !== "recover" &&
        this.snapshot.attempt
      ) {
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
          message:
            command.operation === "start" && code === "attempt_session_missing"
              ? "Recarga la página para preparar la sesión antes de empezar."
              : "Comprobando el resultado guardado. Puedes volver a cargarlo.",
        },
      });
      return;
    }
    const seconds =
      error instanceof GameSessionCommandError && error.failure.retryAfterSeconds !== undefined
        ? Math.max(1, error.failure.retryAfterSeconds)
        : undefined;
    this.retryAt = seconds === undefined ? 0 : this.clock.now() + seconds * 1000;
    const failure = formatFailure(command.operation, code, step.channel);
    const retryable =
      !failure.definitive &&
      (!(error instanceof GameSessionCommandError) || error.failure.retryable);
    const limit = command.operation === "complete" ? 3 : 1;
    const message =
      retryable && this.automaticRetries >= limit
        ? "No hemos podido confirmar la operación"
        : code === "alphabet_deadline_not_reached" || code === "time_trial_not_terminal"
          ? "Esperando a que termine el tiempo de la partida."
          : seconds !== undefined
            ? `Demasiadas solicitudes. Espera ${seconds} ${seconds === 1 ? "segundo" : "segundos"} antes de volver a intentarlo.`
            : failure.message;
    const lifecycle =
      !failure.definitive ||
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
    if (retryable) {
      // Fixed fields only: never log the command, answer, identifiers or tokens.
      console.info(
        JSON.stringify({
          event: "competitive_command_uncertain",
          operation: command.operation,
          retry: this.automaticRetries,
        }),
      );
    }
    if (retryable && this.automaticRetries < limit) {
      const delay = seconds === undefined ? 1000 * 2 ** this.automaticRetries : seconds * 1000;
      this.automaticRetries++;
      this.commit({ type: "completion_retry", scheduled: true });
      this.timers.schedule("completion-retry", delay, () => void this.retry(true));
    }
  }

  private async recoverTerminalIfRequested() {
    if (!this.terminalRecoveryRequested || !this.active) return false;
    this.terminalRecoveryRequested = false;
    if (await this.lifecycle.recoverTerminal()) return true;
    this.timers.clear();
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

  private finalizeExpiredAlphabetPass() {
    if (!this.alphabetPassExpired) return false;
    this.alphabetPassExpired = false;
    return true;
  }

  retry = async (automatic = false) => {
    // React handlers can pass an event; only our internal true means an automatic replay.
    automatic = automatic === true;
    if (
      !this.active ||
      this.snapshot.busy ||
      this.retrying ||
      this.snapshot.lifecycleError?.retryable === false ||
      this.clock.now() < this.retryAt
    )
      return;
    if (!automatic) {
      this.automaticRetries = 0;
      this.timers.cancel("completion-retry");
      this.commit({ type: "completion_retry", scheduled: false });
    }
    if (this.snapshot.lifecycleError?.operation === "projection") {
      if (this.snapshot.lifecycleError.code === "review_pending" && this.snapshot.attempt) {
        await this.lifecycle.reloadResult();
        return;
      }
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
    } finally {
      this.retrying = false;
    }
    await this.recoverTerminalIfRequested();
    if (!accepted && this.finalizeExpiredAlphabetPass()) {
      await this.lifecycle.finalizeAlphabet();
      return;
    }
    if (accepted && this.active) await step.after?.();
    if (
      this.options.challenge.mode === "time-trial" &&
      command.operation !== "complete" &&
      command.operation !== "recover" &&
      this.lifecycle.finalizationRequested()
    )
      await this.lifecycle.finalizeAlphabet();
    if (
      !accepted &&
      this.options.challenge.mode === "time-trial" &&
      ["deadline_reached", "time_trial_terminal"].includes(this.snapshot.lifecycleError?.code ?? "")
    ) {
      this.commit({ type: "command_failed", definitive: true, phase: "finalizing", locked: true });
      await this.lifecycle.finalizeAlphabet();
    }
    if (!accepted && this.snapshot.lifecycleError?.code === "stale_version") await this.reconcile();
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
    if (accepted && this.active) await step.after?.();
    if (this.options.challenge.mode === "time-trial" && this.lifecycle.finalizationRequested())
      await this.lifecycle.finalizeAlphabet();
    if (
      !accepted &&
      this.options.challenge.mode === "time-trial" &&
      ["deadline_reached", "time_trial_terminal"].includes(this.snapshot.lifecycleError?.code ?? "")
    ) {
      this.commit({ type: "command_failed", definitive: true, phase: "finalizing", locked: true });
      await this.lifecycle.finalizeAlphabet();
    }
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
          this.timers.clear();
          this.refresh();
        },
      },
    );
  };
}
