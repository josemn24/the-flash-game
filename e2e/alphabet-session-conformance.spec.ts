import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  alphabetConformanceQuestions,
  alphabetTimeoutConformanceQuestions,
} from "../scripts/fixtures/scenarios/s05.mjs";
import { createLocalAlphabetSessionProvider } from "@/features/game/session/providers/localAlphabet";
import { createRemoteGameSessionProvider } from "@/features/game/session/providers/remote";
import { readStoredQuestion } from "@/lib/question-formats/storedRegistry";
import { confirmed, manualClock, SessionDriver } from "@/test-utils/game-session-conformance/driver";
import type { GameSessionOperation } from "@/types/contracts/game-session";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import type { DurationMs, JsonValue } from "@/types/domain/values";
import type { GameSessionResult } from "@/types/gameplay/authoritative-session";
import type { ServerAlphabetChallenge } from "@/types/gameplay/challenge";
import type { LocalAlphabetDefinition } from "@/types/gameplay/local-alphabet";

type Account = { email: string; password: string };
type FixtureQuestion = {
  letter: string;
  type: "short-text";
  publicPayload: JsonValue;
  solution: JsonValue;
  points?: number;
  timeLimitMs?: number;
};
type FixtureData = {
  publicationId: string;
  challengeItemIds: string[];
  globalTimeLimitMs: number;
  timeoutPublicationId: string;
  timeoutChallengeItemIds: string[];
  timeoutGlobalTimeLimitMs: number;
};
type ScenarioFixture = { users: Record<string, Account>; data: FixtureData };

const origin = process.env.APP_ORIGIN ?? "http://127.0.0.1:3300";
let browserContext: BrowserContext;
let request: APIRequestContext;

function fixture(): ScenarioFixture {
  return JSON.parse(readFileSync("output/fixtures/s05.json", "utf8")) as ScenarioFixture;
}

function localDefinition(data: FixtureData, timeout = false): LocalAlphabetDefinition {
  const questions = (timeout
    ? alphabetTimeoutConformanceQuestions
    : alphabetConformanceQuestions) as FixtureQuestion[];
  const publicationId = timeout ? data.timeoutPublicationId : data.publicationId;
  const itemIds = timeout ? data.timeoutChallengeItemIds : data.challengeItemIds;
  const timeLimitMs = timeout ? data.timeoutGlobalTimeLimitMs : data.globalTimeLimitMs;
  if (questions.length !== itemIds.length) throw new Error("alphabet_fixture_item_mismatch");

  const entries = questions.map((question, index) => ({
    id: itemIds[index]!,
    position: index + 1,
    letter: question.letter,
    questionType: "short-text" as const,
    payloadSchemaVersion: 1,
    timeLimitMs: question.timeLimitMs ?? 60_000,
    points:
      question.points ??
      Math.floor(100 / questions.length) +
        (index === questions.length - 1 ? 100 % questions.length : 0),
  }));
  const levels = questions.map((question, index) => {
    const itemId = itemIds[index]!;
    return {
      challengeItemId: itemId,
      payloadSchemaVersion: 1,
      ...readStoredQuestion({
        questionType: question.type,
        payloadSchemaVersion: 1,
        publicPayload: question.publicPayload,
        solutionPayload: question.solution,
        timeLimitMs: (question.timeLimitMs ?? 60_000) as DurationMs,
        itemPoints: entries[index]!.points,
        receiptId: itemId,
        questionVersionId: `alphabet-version-${index}` as QuestionVersionId,
        mode: "alphabet",
        itemConfigSchemaVersion: 1,
        modeConfigSchemaVersion: 1,
        itemConfig: { letter: question.letter },
        modeConfig: {},
        publicRepresentation: "authorized-runtime",
      }),
    };
  });

  const challenge: ServerAlphabetChallenge = {
    id: publicationId,
    definitionId: timeout ? "s05-timeout-definition" : "s05-definition",
    number: 1,
    title: timeout ? "Alfabeto de timeout" : "Alfabeto de conformidad",
    subtitle: "Recorrido local/remoto de prueba",
    description: "Fixture competitivo persistido para verificar el proveedor local.",
    mode: "alphabet",
    maxScore: 100,
    timeLimitMs,
    entries,
  };
  return { challenge, levels };
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
          child !== undefined &&
          ![
            "sessionId",
            "revision",
            "serverNow",
            "elapsedTimeMs",
            "explanation",
            "questionVersionId",
            "src",
          ].includes(key),
      )
      .map(([key, child]) => {
        if (["presentedAt", "deadlineAt", "lastCorrectAt"].includes(key) && typeof child === "string")
          return [key, Math.round(Date.parse(child) / 10) * 10];
        if (key === "timeUsedMs" && typeof child === "number")
          return [key, Math.round(child / 10) * 10];
        if (key === "timeUsed" && typeof child === "number")
          return [key, Math.round(child * 100) / 100];
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
  const stateFields = [
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
    "answers",
    "answerLength",
  ] as const;
  const project = (state: typeof local.state) =>
    Object.fromEntries(
      stateFields
        .filter((key) => remote.state[key] !== undefined)
        .map((key) => [key, state[key]]),
    );
  expect(normalized(project(local.state))).toEqual(normalized(project(remote.state)));

  if (local.effect === "completed" && remote.effect === "completed") {
    const rows = (review: typeof local.review) =>
      review?.map(({ challengeItemId, publicPayload, solutionPayload }) => ({
        challengeItemId,
        publicPayload,
        solutionPayload,
      }));
    expect(normalized(rows(local.review))).toEqual(normalized(rows(remote.review)));
  }
}

test.beforeAll(async ({ browser }) => {
  const data = fixture();
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

test("local Alphabet matches competitive pass, revisit, scoring and review", async () => {
  test.setTimeout(60_000);
  const data = fixture().data;
  const definition = localDefinition(data);
  const clock = manualClock();
  const local = new SessionDriver(
    createLocalAlphabetSessionProvider({ definition, clock }),
    definition.challenge.id,
    definition.challenge.entries.map((entry) => entry.id),
  );
  const remote = new SessionDriver(
    remoteProvider(request),
    definition.challenge.id,
    definition.challenge.entries.map((entry) => entry.id),
  );
  const presentedAt = new Map<number, number>();
  const cumulativeTime = new Map<number, number>();

  const pair = async (operation: GameSessionOperation, input: object = {}, index = 0) => {
    const remoteCallStartedAt = Date.now();
    const remoteResult = confirmed(await remote.execute(remote.command(operation, input, index)));
    const remoteCallFinishedAt = Date.now();
    if (operation === "start") {
      clock.set(Date.parse(remoteResult.state.deadlineAt!) - definition.challenge.timeLimitMs);
    } else if (operation === "prepare") {
      const time = Date.parse(remoteResult.state.presentedAt!);
      presentedAt.set(index, time);
      clock.set(time);
    } else if (operation === "alphabetPass") {
      const reportedTime = remoteResult.state.timeUsedMs;
      const elapsed =
        typeof reportedTime === "number"
          ? Math.max(0, reportedTime - (cumulativeTime.get(index) ?? 0))
          : Math.max(
              0,
              Math.floor(
                (remoteCallStartedAt + remoteCallFinishedAt) / 2 - presentedAt.get(index)!,
              ),
            );
      clock.set(presentedAt.get(index)! + elapsed);
      cumulativeTime.set(index, (cumulativeTime.get(index) ?? 0) + elapsed);
    } else if (operation === "answer") {
      const total = remoteResult.state.timeUsedMs!;
      const previous = cumulativeTime.get(index) ?? 0;
      clock.set(presentedAt.get(index)! + total - previous);
      cumulativeTime.set(index, total);
    }
    const localResult = confirmed(await local.execute(local.command(operation, input, index)));
    compare(localResult, remoteResult);
    return { local: localResult, remote: remoteResult };
  };

  await pair("prepareSession");
  await pair("start");
  await pair("prepare", {}, 0);
  await pair("alphabetPass", {}, 0);
  await pair("prepare", {}, 1);
  await pair("answer", { answer: "Brasil" }, 1);
  await pair("prepare", {}, 2);
  await pair("answer", { answer: "Canberra incorrecta" }, 2);
  const recovered = await pair("prepare", {}, 0);
  expect(recovered.local.state.progress).toMatchObject({ currentIndex: 0, playedCount: 3 });
  await pair("answer", { answer: "armadillo" }, 0);
  const terminal = await pair("complete");
  expect(terminal.local.state.score).toBe(66);
  expect(terminal.local.state.answers?.map((answer) => answer.status)).toEqual([
    "correct",
    "correct",
    "incorrect",
  ]);
  expect(terminal.local.review).toHaveLength(3);
});

test("local Alphabet matches competitive global timeout and pending-letter review", async () => {
  test.setTimeout(60_000);
  const data = fixture().data;
  const definition = localDefinition(data, true);
  const clock = manualClock();
  const local = new SessionDriver(
    createLocalAlphabetSessionProvider({ definition, clock }),
    definition.challenge.id,
    definition.challenge.entries.map((entry) => entry.id),
  );
  const remote = new SessionDriver(
    remoteProvider(request),
    definition.challenge.id,
    definition.challenge.entries.map((entry) => entry.id),
  );

  await confirmed(await remote.execute(remote.command("prepareSession")));
  const started = confirmed(await remote.execute(remote.command("start")));
  clock.set(Date.parse(started.state.deadlineAt!) - definition.challenge.timeLimitMs);
  await confirmed(await local.execute(local.command("prepareSession")));
  confirmed(await local.execute(local.command("start")));

  const remoteFirst = confirmed(await remote.execute(remote.command("prepare", {}, 0)));
  clock.set(Date.parse(remoteFirst.state.presentedAt!));
  const localFirst = confirmed(await local.execute(local.command("prepare", {}, 0)));
  compare(localFirst, remoteFirst);

  const deadline = Date.parse(remoteFirst.state.deadlineAt!);
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, deadline - Date.now() + 100)));
  const remoteTerminal = confirmed(await remote.execute(remote.command("complete")));
  clock.set(deadline);
  const localTerminal = confirmed(await local.execute(local.command("complete")));
  compare(localTerminal, remoteTerminal);
  expect(localTerminal.state.answers).toHaveLength(18);
  expect(localTerminal.state.answers?.every((answer) => answer.status === "unanswered")).toBe(true);
  expect(localTerminal.review).toHaveLength(18);
});
