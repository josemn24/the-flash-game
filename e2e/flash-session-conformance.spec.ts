import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createLocalFlashSessionProvider } from "@/features/game/session/providers/localFlash";
import { createRemoteGameSessionProvider } from "@/features/game/session/providers/remote";
import { compileFlashDefinition } from "@/features/game/session/providers/localShared/definition";
import { correctActions, type SessionAction } from "@/test-utils/game-session-conformance/corpus";
import {
  confirmed,
  manualClock,
  SessionDriver,
} from "@/test-utils/game-session-conformance/driver";
import { createMockFlashPopFlashDemoDefinition } from "@/infrastructure/mock/localPyramidDefinition";
import type { LocalFlashDefinition } from "@/types/gameplay/local-pyramid";
import type { GameSessionOperation } from "@/types/contracts/game-session";
import type { GameSessionResult } from "@/types/gameplay/authoritative-session";

type Fixture = {
  users: Record<string, { email: string; password: string }>;
  data: { publicationId: string; challengeItemIds: string[] };
};

const origin = process.env.APP_ORIGIN ?? "http://127.0.0.1:3300";
const fixture = () => JSON.parse(readFileSync("output/fixtures/sbr.json", "utf8")) as Fixture;
let browserContext: BrowserContext;
let request: APIRequestContext;

function localDefinitionFor(ids: Fixture["data"]): LocalFlashDefinition {
  const source = createMockFlashPopFlashDemoDefinition();
  return {
    challenge: {
      ...source.challenge,
      id: ids.publicationId,
      slots: source.challenge.slots.map((slot, index) => ({
        ...slot,
        id: ids.challengeItemIds[index]!,
      })),
    },
    levels: source.levels.map((level, index) => ({
      ...level,
      challengeItemId: ids.challengeItemIds[index]!,
    })),
  };
}

function remoteProvider(api: APIRequestContext) {
  const remote = createRemoteGameSessionProvider();
  return {
    async execute(
      command: Parameters<typeof remote.execute>[0],
      options?: Parameters<typeof remote.execute>[1],
    ) {
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
          child !== undefined && !["sessionId", "revision", "explanation", "src"].includes(key),
      )
      .map(([key, child]) => {
        if (["presentedAt", "deadlineAt"].includes(key) && typeof child === "string")
          return [key, Date.parse(child)];
        if (key === "questionVersionId") return [key, undefined];
        return [key, normalized(child)];
      })
      .filter(([, child]) => child !== undefined),
  );
}

function compare(local: GameSessionResult, remote: GameSessionResult) {
  expect(local.kind).toBe(remote.kind);
  if (local.kind !== "accepted" || remote.kind !== "accepted") {
    expect(normalized(local)).toEqual(normalized(remote));
    return;
  }
  expect(local.effect).toBe(remote.effect);
  const sharedFields = [
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
  ] as const;
  const projectState = (state: typeof local.state) => {
    const projection: Record<string, unknown> = {};
    for (const key of sharedFields)
      if (remote.state[key] !== undefined) projection[key] = state[key];
    if (remote.state.answers)
      projection.answers = state.answers?.map((answer) => ({
        challengeItemId: answer.questionId,
        answer: answer.answer,
        status: answer.status,
        isCorrect: answer.isCorrect,
        points: answer.points,
        timeUsed: answer.timeUsed,
        details: answer.details,
      }));
    return projection;
  };
  expect(normalized(projectState(local.state))).toEqual(normalized(projectState(remote.state)));
  if (local.effect === "completed" && remote.effect === "completed") {
    expect(local.review).toHaveLength(16);
    const reviewAnswers = (rows: typeof local.review) =>
      rows?.map(({ challengeItemId, publicPayload, solutionPayload }) => ({
        challengeItemId,
        publicPayload,
        solutionPayload,
      }));
    expect(normalized(reviewAnswers(local.review))).toEqual(
      normalized(reviewAnswers(remote.review)),
    );
  }
}

test.beforeAll(async ({ browser }) => {
  const data = fixture();
  browserContext = await browser.newContext();
  const page = await browserContext.newPage();
  await page.goto(origin);
  await page.getByLabel("Correo electrónico").fill(data.users.owner.email);
  await page.getByLabel("Contraseña").fill(data.users.owner.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
  await page.close();
  request = browserContext.request;
});

test.afterAll(async () => {
  await browserContext?.close();
});

test("Flash local authority conforms to the real SBR backend through answers, points, timing and review", async () => {
  test.setTimeout(120_000);
  const ids = fixture().data;
  const definition = localDefinitionFor(ids);
  const compiled = compileFlashDefinition(definition);
  const clock = manualClock();
  const local = new SessionDriver(
    createLocalFlashSessionProvider({ definition, clock }),
    ids.publicationId,
    ids.challengeItemIds,
  );
  const remote = new SessionDriver(
    remoteProvider(request),
    ids.publicationId,
    ids.challengeItemIds,
  );
  const presentationTimes = new Map<number, number>();

  const pair = async (operation: GameSessionOperation, data: object = {}, index = 0) => {
    const remoteResult = confirmed(await remote.execute(remote.command(operation, data, index)));
    if (operation === "prepare") {
      const presentedAt = Date.parse(remoteResult.state.presentedAt!);
      presentationTimes.set(index, presentedAt);
      clock.set(presentedAt);
    } else if (operation === "answer") {
      clock.set(presentationTimes.get(index)! + remoteResult.state.timeUsedMs!);
    }
    const localResult = confirmed(await local.execute(local.command(operation, data, index)));
    compare(localResult, remoteResult);
    return { local: localResult, remote: remoteResult };
  };

  await pair("prepareSession");
  await pair("start");
  for (let index = 0; index < compiled.levels.length; index++) {
    await pair("prepare", {}, index);
    const actions = correctActions(compiled.levels[index]!.question);
    expect(actions).toHaveLength(1);
    const action = actions[0]! as Extract<SessionAction, { operation: "answer" }>;
    expect(action.operation).toBe("answer");
    await pair("answer", action.input, index);
  }

  const result = await pair("complete");
  expect(result.local.state.score).toBe(definition.challenge.maxScore);
  expect(result.local.state.answers).toHaveLength(16);
  expect(result.local.state.answers?.map((answer) => answer.status)).toEqual(
    Array.from({ length: 16 }, () => "correct"),
  );
});
