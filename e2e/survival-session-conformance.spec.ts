import { sessionValidationContext } from "@/features/game/session/sessionResult";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readStoredQuestion } from "@/lib/question-formats/storedRegistry";
import { createLocalSurvivalSessionProvider } from "@/features/game/session/providers/localSurvival";
import { createRemoteGameSessionProvider } from "@/features/game/session/providers/remote";
import {
  manualClock,
  SessionDriver,
  confirmed,
} from "@/test-utils/game-session-conformance/driver";
import type { GameSessionOperation } from "@/types/contracts/game-session";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import type { DurationMs, JsonValue } from "@/types/domain/values";
import type { GameSessionResult } from "@/types/gameplay/authoritative-session";
import type { ServerSurvivalChallenge } from "@/types/gameplay/challenge";
import type { LocalSurvivalDefinition } from "@/types/gameplay/local-pyramid";

type Account = { email: string; password: string };
type FixtureQuestion = {
  slug: string;
  type: "multiple-choice";
  points: number;
  timeLimitMs: number;
  payloadSchemaVersion: number;
  publicPayload: Record<string, unknown>;
  solutionPayload: Record<string, unknown>;
};
type Fixture = {
  users: Record<string, Account>;
  data: {
    survivalChallengeId: string;
    survivalChallengeVersionId: string;
    survivalPublicationId: string;
    survivalQuestions: FixtureQuestion[];
    survivalQuestionVersionIds: string[];
    survivalChallengeItemIds: string[];
  };
};

const origin = process.env.APP_ORIGIN ?? "http://127.0.0.1:3300";
const fixture = () => JSON.parse(readFileSync("output/fixtures/sbr.json", "utf8")) as Fixture;
let browserContext: BrowserContext;
let request: APIRequestContext;

function localDefinitionFor(data: Fixture["data"]): LocalSurvivalDefinition {
  const levels = data.survivalQuestions.map((question, index) => {
    const questionVersionId = data.survivalQuestionVersionIds[index]! as QuestionVersionId;
    const resolved = readStoredQuestion({
      questionType: question.type,
      payloadSchemaVersion: question.payloadSchemaVersion,
      publicPayload: question.publicPayload as JsonValue,
      solutionPayload: question.solutionPayload as JsonValue,
      timeLimitMs: question.timeLimitMs as DurationMs,
      itemPoints: question.points,
      receiptId: data.survivalChallengeItemIds[index]!,
      questionVersionId,
      mode: "survival",
      itemConfigSchemaVersion: 1,
      modeConfigSchemaVersion: 1,
      itemConfig: {},
      modeConfig: {},
      publicRepresentation: "authorized-runtime",
    });
    return {
      ...resolved,
      challengeItemId: data.survivalChallengeItemIds[index]!,
      payloadSchemaVersion: question.payloadSchemaVersion,
    };
  });
  const challenge: ServerSurvivalChallenge = {
    id: data.survivalPublicationId,
    definitionId: data.survivalChallengeId,
    number: 2,
    title: "Supervivencia de conformidad",
    subtitle: "Tres preguntas de control",
    description: "Fixture local/remota para verificar la autoridad de Supervivencia.",
    mode: "survival",
    lives: 1,
    maxScore: 100,
    slots: data.survivalQuestions.map((question, index) => ({
      id: data.survivalChallengeItemIds[index]!,
      position: index + 1,
      questionType: question.type,
      payloadSchemaVersion: question.payloadSchemaVersion,
      timeLimitMs: question.timeLimitMs,
      points: question.points,
    })),
  };
  return { challenge, levels };
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
    expect(local.review).toHaveLength(2);
    const reviewRows = (rows: typeof local.review) =>
      rows?.map(({ challengeItemId, publicPayload, solutionPayload }) => ({
        challengeItemId,
        publicPayload,
        solutionPayload,
      }));
    expect(normalized(reviewRows(local.review))).toEqual(normalized(reviewRows(remote.review)));
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

test("local Survival conforms to the real SBR backend through life loss, elimination and review", async () => {
  test.setTimeout(60_000);
  const data = fixture().data;
  const definition = localDefinitionFor(data);
  const clock = manualClock();
  const local = new SessionDriver(
    createLocalSurvivalSessionProvider({ definition, clock }),
    data.survivalPublicationId,
    data.survivalChallengeItemIds,
  );
  const remote = new SessionDriver(
    remoteProvider(request, definition.challenge),
    data.survivalPublicationId,
    data.survivalChallengeItemIds,
  );
  const presentedAt = new Map<number, number>();

  const pair = async (operation: GameSessionOperation, input: object = {}, index = 0) => {
    const remoteResult = confirmed(await remote.execute(remote.command(operation, input, index)));
    if (operation === "prepare") {
      const time = Date.parse(remoteResult.state.presentedAt!);
      presentedAt.set(index, time);
      clock.set(time);
    } else if (operation === "answer") {
      clock.set(presentedAt.get(index)! + remoteResult.state.timeUsedMs!);
    }
    const localResult = confirmed(await local.execute(local.command(operation, input, index)));
    compare(localResult, remoteResult);
    return { local: localResult, remote: remoteResult };
  };

  await pair("prepareSession");
  await pair("start");
  await pair("prepare", {}, 0);
  await pair("answer", { answer: "Lisboa" }, 0);
  await pair("prepare", {}, 1);
  await pair("answer", { answer: "Oporto" }, 1);
  const terminal = await pair("complete");

  expect(terminal.local.state.answers?.map((answer) => answer.status)).toEqual([
    "correct",
    "incorrect",
  ]);
  expect(terminal.local.state.score).toBe(terminal.local.state.answers?.[0]?.points);
  expect(terminal.local.state.score).toBeGreaterThan(0);
  expect(terminal.local.review).toHaveLength(2);
});
