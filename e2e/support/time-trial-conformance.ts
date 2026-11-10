import { sessionValidationContext } from "@/features/game/session/sessionResult";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createLocalTimeTrialSessionProvider } from "@/features/game/session/providers/localTimeTrial";
import { createTimeTrialTestDefinition } from "@/test-utils/game-session-conformance/timeTrialDefinition";
import { createRemoteGameSessionProvider } from "@/features/game/session/providers/remote";
import {
  manualClock,
  SessionDriver,
  confirmed,
} from "@/test-utils/game-session-conformance/driver";
import type { GameSessionOperation } from "@/types/contracts/game-session";
import type { GameSessionResult } from "@/types/gameplay/authoritative-session";
import type { LocalTimeTrialDefinition } from "@/types/gameplay/local-time-trial";

type Account = { email: string; password: string };
type ScenarioData = {
  publicationId: string;
  challengeItemIds: string[];
  globalTimeLimitMs?: number | null;
};
type ScenarioFixture = { users: Record<string, Account>; data: ScenarioData };
type Format = "queens" | "connect-pairs";

const origin = process.env.APP_ORIGIN ?? "http://127.0.0.1:3300";

function fixture(scenario: string): ScenarioFixture {
  return JSON.parse(readFileSync(`output/fixtures/${scenario}.json`, "utf8")) as ScenarioFixture;
}

function localDefinition(
  data: ScenarioData,
  format: Format,
  queensTimeoutPartialCredit?: boolean,
  connectPairsTimeoutPartialCredit?: boolean,
): LocalTimeTrialDefinition {
  return createTimeTrialTestDefinition({
    format,
    challengeId: data.publicationId,
    itemIds: data.challengeItemIds,
    globalTimeLimitMs: data.globalTimeLimitMs ?? undefined,
    queensTimeoutPartialCredit,
    connectPairsTimeoutPartialCredit,
  });
}

function remoteProvider(
  api: APIRequestContext,
  challenge: import("@/types/gameplay/challenge").CompetitiveChallenge,
): import("@/application/ports/game-session").GameSessionProvider {
  const remote = createRemoteGameSessionProvider({ context: sessionValidationContext(challenge) });
  return {
    async execute(command, options) {
      const original = globalThis.fetch;
      globalThis.fetch = async (url, init) => {
        const response = await api.fetch(new URL(String(url), origin).href, {
          method: init?.method,
          headers: { ...(init?.headers as Record<string, string>), origin },
          data: init?.body as string,
        });
        return new Response(await response.text(), {
          status: response.status(),
          headers: response
            .headersArray()
            .filter((header) => header.name.toLowerCase() !== "set-cookie")
            .map(({ name, value }): [string, string] => [name, value]),
        });
      };
      try {
        return await remote.execute(command, options);
      } finally {
        globalThis.fetch = original;
      }
    },
  };
}

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, child]) =>
          child !== undefined &&
          child !== null &&
          ![
            "sessionId",
            "revision",
            "serverNow",
            "elapsedTimeMs",
            "lastCorrectElapsedMs",
            "explanation",
            "src",
            "questionVersionId",
          ].includes(key),
      )
      .map(([key, child]) => {
        if (
          ["presentedAt", "deadlineAt", "clockStartedAt"].includes(key) &&
          typeof child === "string"
        )
          return [key, Date.parse(child)];
        return [key, normalized(child)];
      }),
  );
}

function compare(local: GameSessionResult, remote: GameSessionResult) {
  expect(local.kind).toBe(remote.kind);
  if (local.kind !== "accepted" || remote.kind !== "accepted") {
    expect(normalized(local)).toEqual(normalized(remote));
    return;
  }
  expect(local.effect).toBe(remote.effect);
  if (remote.state.timeTrial) {
    const actual = local.state.timeTrial?.lastCorrectElapsedMs;
    const expected = remote.state.timeTrial.lastCorrectElapsedMs;
    if (expected === null) expect(actual).toBeNull();
    else {
      // SQL floors global/per-board durations independently; JS Date truncates timestamps.
      // Those quantizations can differ by 1 ms even with the same authoritative input.
      expect(typeof actual).toBe("number");
      expect(Math.abs(actual! - expected)).toBeLessThanOrEqual(1);
    }
  }
  const comparable = [
    "challengeItemId",
    "publicPayload",
    "phase",
    "status",
    "points",
    "timeUsedMs",
    "timedOut",
    "score",
    "terminalReason",
    "presentedAt",
    "deadlineAt",
    "ready",
    "resumed",
    "progress",
    "timeTrial",
    "queens",
    "incorrectValidations",
    "maxIncorrectValidations",
    "solved",
    "correct",
    "terminal",
  ] as const;
  const project = (state: typeof local.state) =>
    Object.fromEntries(
      comparable.filter((key) => remote.state[key] !== undefined).map((key) => [key, state[key]]),
    );
  expect(normalized(project(local.state))).toEqual(normalized(project(remote.state)));
  if (remote.state.answers) {
    const answers = (state: typeof local.state) =>
      state.answers?.map(
        ({ questionId, answer, status, isCorrect, points, details, reviewState }) => ({
          questionId,
          answer,
          status,
          isCorrect,
          points,
          details,
          reviewState,
        }),
      );
    expect(normalized(answers(local.state))).toEqual(normalized(answers(remote.state)));
    for (const [index, remoteAnswer] of remote.state.answers.entries()) {
      const localAnswer = local.state.answers![index]!;
      // Per-board times can have the same millisecond quantization difference as the global time.
      const localMs = Math.round(localAnswer.timeUsed * 1_000);
      const remoteMs = Math.round(remoteAnswer.timeUsed * 1_000);
      expect(Math.abs(localMs - remoteMs)).toBeLessThanOrEqual(1);
    }
  }
  if (local.effect === "completed" && remote.effect === "completed") {
    const reviewRows = (rows: typeof local.review) =>
      rows
        ?.filter((row) => row.publicPayload !== null && row.solutionPayload !== null)
        .map(({ challengeItemId, publicPayload, solutionPayload }) => ({
          challengeItemId,
          publicPayload,
          solutionPayload,
        }));
    expect(normalized(reviewRows(local.review))).toEqual(normalized(reviewRows(remote.review)));
  }
}

export function registerTimeTrialConformance(options: {
  scenario: string;
  format: Format;
  timeout?: "partial" | "checkpoint";
  queensTimeoutPartialCredit?: boolean;
  connectPairsTimeoutPartialCredit?: boolean;
}) {
  let browserContext: BrowserContext;
  let request: APIRequestContext;

  test.beforeAll(async ({ browser }) => {
    const data = fixture(options.scenario);
    browserContext = await browser.newContext();
    const page = await browserContext.newPage();
    await page.goto(origin);
    const label =
      options.timeout === "checkpoint" ? "carol" : options.timeout ? "alice" : "conformance";
    const account = data.users[label]!;
    await page.getByLabel("Correo electrónico").fill(account.email);
    await page.getByLabel("Contraseña").fill(account.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
    await page.close();
    request = browserContext.request;
  });

  test.afterAll(async () => {
    await browserContext?.close();
  });

  test(
    options.timeout === "checkpoint"
      ? `local ${options.format} matches competitive full credit from a checkpoint at expiry`
      : options.timeout
        ? `local ${options.format} matches competitive global timeout and review`
        : `local ${options.format} matches competitive progress, scoring and review`,
    async () => {
      test.setTimeout(60_000);
      const data = fixture(options.scenario).data;
      const definition = localDefinition(
        data,
        options.format,
        options.queensTimeoutPartialCredit,
        options.connectPairsTimeoutPartialCredit,
      );
      const clock = manualClock();
      const local = new SessionDriver(
        createLocalTimeTrialSessionProvider({ definition, clock }),
        data.publicationId,
        data.challengeItemIds,
      );
      const remote = new SessionDriver(
        remoteProvider(request, definition.challenge),
        data.publicationId,
        data.challengeItemIds,
      );
      const presentedAt = new Map<number, number>();

      const pair = async (operation: GameSessionOperation, input: object = {}, index = 0) => {
        const remoteResult = confirmed(
          await remote.execute(remote.command(operation, input, index)),
        );
        if (operation === "prepare") {
          const time = Date.parse(remoteResult.state.presentedAt!);
          presentedAt.set(index, time);
          clock.set(time);
        } else if (operation === "queensValidation" || operation === "answer") {
          clock.set(presentedAt.get(index)! + remoteResult.state.timeUsedMs!);
        }
        const localResult = confirmed(await local.execute(local.command(operation, input, index)));
        compare(localResult, remoteResult);
        return { local: localResult, remote: remoteResult };
      };

      await pair("prepareSession");
      await pair("start");
      const first = await pair("prepare", {}, 0);

      const expire = async () => {
        const deadline = Date.parse(first.remote.state.deadlineAt!);
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, deadline - Date.now() + 150)),
        );
        clock.set(deadline);
      };

      if (options.timeout === "partial") {
        if (options.queensTimeoutPartialCredit) await pair("queensDraft", { queens: [10] });
        if (options.connectPairsTimeoutPartialCredit)
          await pair("connectPairsDraft", {
            paths: { a: [3, 2, 1, 0], b: [4, 9, 8, 7], c: [6, 5, 10, 11], d: [12, 13, 14, 19] },
          });
        await expire();
        const { local: localResult, remote: remoteResult } = await pair("complete");
        expect(localResult.state.timeTrial).toMatchObject({
          endReason: "time_limit",
          elapsedTimeMs: definition.challenge.timeLimitMs,
        });
        expect(remoteResult.state.timeTrial?.elapsedTimeMs).toBe(definition.challenge.timeLimitMs);
        expect(localResult.state.answers).toMatchObject([
          options.queensTimeoutPartialCredit
            ? { status: "partial", points: 10, isCorrect: false }
            : options.connectPairsTimeoutPartialCredit
              ? {
                  status: "partial",
                  points: 7,
                  isCorrect: false,
                  details: { connectedPairs: 3, coveredCells: 12 },
                }
              : { status: "unanswered", points: 0 },
        ]);
        expect(localResult.review).toHaveLength(1);
        return;
      }

      for (let index = 0; index < definition.levels.length; index++) {
        if (index > 0) await pair("prepare", {}, index);
        const saveOnly = options.timeout === "checkpoint" && index === definition.levels.length - 1;
        if (options.format === "queens") {
          const level = definition.levels[index]!;
          if (level.solution.type !== "queens") throw new Error("expected Queens fixture");
          await pair(
            saveOnly ? "queensDraft" : "queensValidation",
            { queens: level.solution.payload.solution },
            index,
          );
        } else {
          const level = definition.levels[index]!;
          if (level.solution.type !== "connect-pairs")
            throw new Error("expected Connect Pairs fixture");
          const paths = level.solution.payload.paths;
          if (saveOnly) await pair("connectPairsDraft", { paths }, index);
          else await pair("answer", { answer: { paths } }, index);
        }
      }
      if (options.timeout === "checkpoint") await expire();
      const terminal = await pair(options.timeout === "checkpoint" ? "recover" : "complete");
      expect(terminal.local.state.score).toBe(100);
      if (options.timeout === "checkpoint") {
        expect(terminal.remote.state.timeTrial).toMatchObject({
          endReason: "all_solved",
          lastCorrectElapsedMs: definition.challenge.timeLimitMs,
          solvedCount: definition.levels.length,
        });
        expect(terminal.remote.state.answers?.at(-1)).toMatchObject({
          status: "correct",
          points: definition.challenge.slots.at(-1)!.points,
          reviewState: { type: options.format },
        });
      }
      expect(
        Math.abs(
          (terminal.local.state.timeTrial?.elapsedTimeMs ?? 0) -
            (terminal.remote.state.timeTrial?.elapsedTimeMs ?? 0),
        ),
      ).toBeLessThanOrEqual(10);
      expect(terminal.local.state.answers?.map((answer) => answer.status)).toEqual([
        "correct",
        "correct",
      ]);
      expect(terminal.local.review).toHaveLength(2);
    },
  );
}
