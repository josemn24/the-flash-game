import type { GameRoomContext } from "@/types/view-models/room";
import type { ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import { createCompetitiveAttemptClient, type CompetitiveAttemptClient } from "../attemptClient";
import {
  CompetitiveCommandError,
  createCompetitiveIdempotencyKey,
  type CompetitiveJsonObject,
} from "../transport";
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
  private automaticRetries = 0;
  private abortController = new AbortController();
  private retrying = false;
  private terminalRecoveryAttempted = false;
  private terminalRecoveryRequested = false;
  private refresh: () => void;
  private readonly client: CompetitiveAttemptClient;
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
    if (roomContext.result && !terminalReview?.length) {
      this.snapshot.lifecycleError = {
        operation: "projection",
        code: "review_pending",
        message: "Revisión temporalmente no disponible. Puedes volver a cargarla.",
      };
    }
    this.client = options.client ?? createCompetitiveAttemptClient(this.abortController.signal);
    this.executor = new CommandExecutor(
      this.client,
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
    this.abortController.abort();
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
        command.operation === "start" || command.operation === "takeover"
          ? String(response.attemptId)
          : this.snapshot.attempt?.id;
      const lockVersion =
        response.lockVersion === undefined
          ? this.snapshot.attempt?.lockVersion
          : Number(response.lockVersion);
      if (
        command.operation !== "abandon" &&
        command.operation !== "prepareSession" &&
        (!attemptId || !Number.isSafeInteger(lockVersion))
      )
        throw new Error("invalid_attempt_response");
      step.accept(response, command);
      this.commit({
        type: "command_succeeded",
        attempt: attemptId ? { id: attemptId, lockVersion: lockVersion! } : null,
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
        error instanceof CompetitiveCommandError &&
        error.code === "attempt_control_required"
      ) {
        const attempt = error.details?.attempt;
        const attemptObject =
          attempt && typeof attempt === "object" && !Array.isArray(attempt)
            ? (attempt as Record<string, unknown>)
            : undefined;
        const attemptId =
          attemptObject && typeof attemptObject.attemptId === "string"
            ? attemptObject.attemptId
            : null;
        const lockVersion = attemptObject ? Number(attemptObject.lockVersion) : Number.NaN;
        const deadlineAt =
          attemptObject?.deadlineAt === null || typeof attemptObject?.deadlineAt === "string"
            ? (attemptObject.deadlineAt as string | null)
            : null;
        if (attemptId && Number.isSafeInteger(lockVersion) && lockVersion > 0) {
          this.pendingStep = undefined;
          this.commit({
            type: "control_required",
            transfer: {
              attemptId,
              lockVersion,
              deadlineAt,
              scheduledChallengeId: this.options.challenge.id,
              idempotencyKey: createCompetitiveIdempotencyKey("takeover"),
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
  private async failed(command: PendingCommand, step: CommandStep, error: unknown) {
    const code = error instanceof CompetitiveCommandError ? error.code : undefined;
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
      } else if (!(error instanceof CompetitiveCommandError) || error.status === 0) {
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
      (error instanceof CompetitiveCommandError &&
        error.status === 401 &&
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
      error instanceof CompetitiveCommandError &&
      (error.retryAfterSeconds !== undefined ||
        error.status === 429 ||
        code === "alphabet_deadline_not_reached")
        ? Math.max(1, error.retryAfterSeconds ?? 1)
        : undefined;
    this.retryAt = seconds === undefined ? 0 : Date.now() + seconds * 1000;
    const failure = formatFailure(command.operation, code, step.channel);
    const retryable =
      !failure.definitive &&
      (!(error instanceof CompetitiveCommandError) ||
        error.status === 0 ||
        error.status >= 500 ||
        error.status === 429 ||
        code === "invalid_json_response" ||
        code === "alphabet_deadline_not_reached");
    const limit = command.operation === "complete" ? 3 : 1;
    const message =
      retryable && this.automaticRetries >= limit
        ? "No hemos podido confirmar la operación"
        : code === "alphabet_deadline_not_reached"
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

  retry = async (automatic = false) => {
    // React handlers can pass an event; only our internal true means an automatic replay.
    automatic = automatic === true;
    if (
      !this.active ||
      this.snapshot.busy ||
      this.retrying ||
      this.snapshot.lifecycleError?.retryable === false ||
      Date.now() < this.retryAt
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
    if (accepted && this.active) await step.after?.();
    if (!accepted && this.snapshot.lifecycleError?.code === "stale_version") await this.reconcile();
  };
  reconcile = async () => {
    if (
      this.reconciling ||
      !this.active ||
      this.snapshot.busy ||
      this.snapshot.lifecycleError?.retryable === false ||
      Date.now() < this.retryAt
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
          attemptId: transfer.attemptId,
          scheduledChallengeId: transfer.scheduledChallengeId,
          lockVersion: transfer.lockVersion,
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
