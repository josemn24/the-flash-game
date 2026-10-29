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

function localDefinition(data: ScenarioData, format: Format): LocalTimeTrialDefinition {
  return createTimeTrialTestDefinition({
    format,
    challengeId: data.publicationId,
    itemIds: data.challengeItemIds,
    globalTimeLimitMs: data.globalTimeLimitMs ?? undefined,
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
    expect(
      normalized(
        local.state.answers?.map((answer) => ({
          challengeItemId: answer.questionId,
          answer: answer.answer,
          status: answer.status,
          isCorrect: answer.isCorrect,
          points: answer.points,
          timeUsed: answer.timeUsed,
          details: answer.details,
        })),
      ),
    ).toEqual(
      normalized(
        remote.state.answers.map((answer) => ({
          challengeItemId: answer.questionId,
          answer: answer.answer,
          status: answer.status,
          isCorrect: answer.isCorrect,
          points: answer.points,
          timeUsed: answer.timeUsed,
          details: answer.details,
        })),
      ),
    );
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
  timeout?: boolean;
}) {
  let browserContext: BrowserContext;
  let request: APIRequestContext;

  test.beforeAll(async ({ browser }) => {
    const data = fixture(options.scenario);
    browserContext = await browser.newContext();
    const page = await browserContext.newPage();
    await page.goto(origin);
    await page.getByLabel("Correo electrónico").fill(data.users.alice!.email);
    await page.getByLabel("Contraseña").fill(data.users.alice!.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
    await page.close();
    request = browserContext.request;
  });

  test.afterAll(async () => {
    await browserContext?.close();
  });

  test(
    options.timeout
      ? "local Queens matches competitive global timeout and review"
      : `local ${options.format} matches competitive progress, scoring and review`,
    async () => {
      test.setTimeout(60_000);
      const data = fixture(options.scenario).data;
      const definition = localDefinition(data, options.format);
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

      if (options.timeout) {
        const deadline = Date.parse(first.remote.state.deadlineAt!);
        const waitMs = Math.max(0, deadline - Date.now() + 150);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        const remoteResult = confirmed(await remote.execute(remote.command("complete")));
        clock.set(deadline);
        const localResult = confirmed(await local.execute(local.command("complete")));
        compare(localResult, remoteResult);
        expect(localResult.state.timeTrial).toMatchObject({
          endReason: "time_limit",
          elapsedTimeMs: 3_000,
        });
        expect(remoteResult.state.timeTrial?.elapsedTimeMs).toBe(3_000);
        expect(localResult.state.answers?.map((answer) => answer.status)).toEqual(["unanswered"]);
        expect(localResult.review).toHaveLength(1);
        return;
      }

      for (let index = 0; index < definition.levels.length; index++) {
        if (index > 0) await pair("prepare", {}, index);
        if (options.format === "queens") {
          const level = definition.levels[index]!;
          if (level.solution.type !== "queens") throw new Error("expected Queens fixture");
          await pair("queensValidation", { queens: level.solution.payload.solution }, index);
        } else {
          const level = definition.levels[index]!;
          if (level.solution.type !== "connect-pairs")
            throw new Error("expected Connect Pairs fixture");
          await pair("answer", { answer: { paths: level.solution.payload.paths } }, index);
        }
      }
      const terminal = await pair("complete");
      expect(terminal.local.state.score).toBe(100);
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
