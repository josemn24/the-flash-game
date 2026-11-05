import { describe, expect, it } from "vitest";
import {
  competitiveQuestionTypesFor,
  competitivePayloadSchemaVersionsFor,
} from "@/lib/question-formats/definitions";
import { createLocalPyramidSessionProvider } from "./localPyramid";
import {
  sessionCases,
  definitionFor,
  resolvedFor,
  correctActions,
  adverseActions,
  testDictionaries,
} from "@/test-utils/game-session-conformance/corpus";
import {
  SessionDriver,
  manualClock,
  confirmed,
  loseConfirmation,
} from "@/test-utils/game-session-conformance/driver";
import type { LocalPyramidDefinition } from "@/types/gameplay/local-pyramid";
import { compileDefinition } from "./localShared/definition";

function setup(test = sessionCases[0]!, definition: LocalPyramidDefinition = definitionFor(test)) {
  const clock = manualClock();
  const provider = createLocalPyramidSessionProvider({
    definition,
    clock,
    createSessionId: () => "local-session",
    dictionaries: testDictionaries,
  });
  const driver = new SessionDriver(
    provider,
    definition.challenge.id,
    definition.challenge.levels.map((l) => l.id),
  );
  return { clock, provider, driver, definition };
}

describe("local Pyramid definition and published format coverage", () => {
  it("covers every competitive Pyramid format and version, using the real private resolvers", () => {
    for (const format of competitiveQuestionTypesFor("pyramid")) {
      for (const version of competitivePayloadSchemaVersionsFor(format, "pyramid"))
        expect(
          sessionCases.some(
            (c) => c.document.type === format && c.document.payloadSchemaVersion === version,
          ),
        ).toBe(true);
    }
    expect(new Set(sessionCases.map((c) => c.document.type)).size).toBe(21);
  });
  it.each(sessionCases)("validates and resolves $id", (test) => {
    const definition = definitionFor(test);
    expect(compileDefinition(definition).levels[0]!.question.type).toBe(test.document.type);
    const invalid = structuredClone(definition);
    (invalid.challenge.levels[0] as { points: number }).points++;
    expect(() => createLocalPyramidSessionProvider({ definition: invalid })).toThrow(
      "invalid_local_pyramid_definition",
    );
  });
  it("requires preloaded dictionaries and rejects mismatched, unsupported and duplicate levels", () => {
    const wordle = sessionCases.find((c) => c.document.type === "mini-wordle")!;
    expect(() => createLocalPyramidSessionProvider({ definition: definitionFor(wordle) })).toThrow(
      "missing_local_dictionary",
    );
    const definition = definitionFor(sessionCases[0]!);
    const bad = structuredClone(definition);
    (bad.levels[1] as { challengeItemId: string }).challengeItemId = bad.levels[0]!.challengeItemId;
    expect(() => setup(sessionCases[0], bad)).toThrow();
  });
});

describe.each(sessionCases)("local protocol: $id", (test) => {
  it("keeps published mistake/partial scenarios at zero and does not advance", async () => {
    const { driver, definition } = setup(test);
    await driver.begin();
    await driver.open();
    for (const action of adverseActions(resolvedFor(definition)))
      await driver.execute(driver.command(action.operation, action.input));
    expect((await driver.issue("complete")).state.score).toBe(0);
  });
  it("prepares without time, activates once and evaluates the published solution", async () => {
    const { driver, clock, definition } = setup(test);
    await driver.begin();
    const prepared = await driver.issue("prepare");
    expect(prepared.state).toMatchObject({ presentedAt: null, deadlineAt: null, timedOut: false });
    expect(prepared).not.toHaveProperty("review");
    const payload = JSON.stringify(prepared.state.publicPayload);
    for (const key of [
      "correctAnswer",
      "acceptedAnswers",
      "solution",
      "solutionPaths",
      "referenceSolution",
      "matches",
    ]) {
      expect(payload).not.toContain(`"${key}"`);
    }
    expect(JSON.stringify(prepared)).not.toContain("item-1");
    clock.advance(5000);
    const activation = await driver.issue("activate");
    clock.advance(1000);
    expect((await driver.issue("activate")).state.deadlineAt).toBe(activation.state.deadlineAt);
    let result = activation;
    for (const action of correctActions(resolvedFor(definition)))
      result = await driver.action(action);
    expect(result).toMatchObject({ effect: "evaluated", state: { status: "correct" } });
    expect(result.state.points).toBeGreaterThan(0);
    expect(result).not.toHaveProperty("review");
    const recovery = await driver.issue("recover");
    expect(recovery.state.answers).toHaveLength(1);
    expect(recovery.state.phase).toBe("briefing");
  });
  it("recovers an interrupted interaction according to its accepted events and closes the ascent", async () => {
    const { driver } = setup(test);
    await driver.begin();
    await driver.open();
    const result = await driver.issue("recover");
    expect(result.effect).toBe("completed");
    expect(result.state.answers).toHaveLength(1);
    expect(result.state.score).toBe(0);
    if (result.effect !== "completed") throw new Error("not terminal");
    expect(result.review).toHaveLength(1);
    expect(result.review?.some((r) => r.challengeItemId === "item-1")).toBe(false);
    expect((await driver.issue("recover")).state.answers).toHaveLength(1);
  });
  it("confirms timeout at the exact deadline without awarding points", async () => {
    const { driver, clock } = setup(test);
    await driver.begin();
    const activation = await driver.open();
    clock.set(Date.parse(activation.state.deadlineAt!));
    const result = await driver.issue("answer", { answer: null });
    expect(result.state).toMatchObject({ timedOut: true, points: 0 });
    expect((await driver.issue("complete")).state.phase).toBe("results");
  });
});

describe("local authority, replay and recovery", () => {
  it("replays a recovery whose confirmation was lost using the original session and revision", async () => {
    const { provider, definition } = setup();
    const driver = new SessionDriver(
      loseConfirmation(provider, "recover"),
      definition.challenge.id,
      definition.challenge.levels.map((l) => l.id),
    );
    await driver.begin();
    await driver.issue("prepare");
    const command = driver.command("recover");
    expect((await driver.execute(command)).kind).toBe("uncertain");
    expect(confirmed(await driver.execute(command)).state).toMatchObject({
      phase: "briefing",
      answers: [],
    });
  });
  it("copies caller definitions and dictionaries before accepting any command", async () => {
    const definition = definitionFor(sessionCases.find((c) => c.document.type === "mini-wordle")!);
    const words = new Set(["ABCDE"]);
    const provider = createLocalPyramidSessionProvider({
      definition,
      clock: manualClock(),
      dictionaries: new Map([["es-general-5.v1", words]]),
    });
    words.clear();
    const original = definition.levels[0]!.publicQuestion.prompt;
    (definition.levels[0]!.publicQuestion as { prompt: string }).prompt =
      "changed after construction";
    const driver = new SessionDriver(
      provider,
      definition.challenge.id,
      definition.challenge.levels.map((l) => l.id),
    );
    await driver.begin();
    const prepared = await driver.issue("prepare");
    expect(prepared.state.publicPayload).toMatchObject({ question: original });
    await driver.issue("activate");
    expect((await driver.issue("miniWordleGuess", { guess: "ABCDE" })).effect).toBe("progress");
  });
  it("replays before revision/deadline checks and rejects a changed payload without mutation", async () => {
    const { driver, clock } = setup();
    await driver.begin();
    await driver.open();
    const command = driver.command("answer", { answer: "A" });
    const result = await driver.execute(command);
    clock.advance(3600000);
    expect(await driver.execute(command)).toEqual(result);
    expect(
      await driver.execute({
        ...command,
        input: { ...command.input, answer: "B" },
      } as typeof command),
    ).toMatchObject({ kind: "rejected", code: "idempotency_conflict" });
    expect(await driver.execute(driver.command("prepare", { revision: 1 }))).toMatchObject({
      code: "stale_version",
    });
    expect((await driver.issue("recover")).state.answers).toHaveLength(1);
  });
  it("keeps preparation and recovered briefings untimed; rejects premature completion", async () => {
    const { driver, clock } = setup();
    await driver.begin();
    const revision = driver.revision;
    expect(await driver.execute(driver.command("complete"))).toMatchObject({
      code: "no_evaluated_answers",
    });
    expect(driver.revision).toBe(revision);
    await driver.issue("prepare");
    clock.advance(999999);
    expect((await driver.issue("recover")).state).toMatchObject({ phase: "briefing", answers: [] });
    expect((await driver.issue("prepare")).state.deadlineAt).toBeNull();
  });
  it("preserves accepted receipts when cancelled between receiving and evaluating", async () => {
    const { driver } = setup();
    await driver.begin();
    await driver.open();
    const controller = new AbortController();
    const command = driver.command("answer", { answer: "A" });
    const pending = driver.execute(command, controller.signal);
    await Promise.resolve();
    controller.abort();
    expect(await pending).toMatchObject({ kind: "uncertain", code: "request_cancelled" });
    await driver.issue("start");
    const pendingRevision = driver.revision;
    expect(await driver.execute(driver.command("complete"))).toMatchObject({
      code: "unfinished_interaction",
    });
    expect((await driver.issue("start")).state.revision).toBe(pendingRevision);
    const replay = confirmed(await driver.execute(command));
    expect(replay.state).toMatchObject({ status: "correct", points: 14 });
    expect((await driver.issue("recover")).state.answers).toHaveLength(1);
  });
  it("supports lost confirmations, cancellation before acceptance, isolated instances and cloned responses", async () => {
    const { provider, definition } = setup();
    const driver = new SessionDriver(
      loseConfirmation(provider, "answer"),
      definition.challenge.id,
      definition.challenge.levels.map((l) => l.id),
    );
    await driver.begin();
    await driver.open();
    const command = driver.command("answer", { answer: "A" });
    expect(await driver.execute(command)).toMatchObject({ kind: "uncertain" });
    const accepted = confirmed(await driver.execute(command));
    (accepted.state as { points: number }).points = -123;
    expect(confirmed(await driver.execute(command)).state.points).toBe(14);
    const fresh = setup();
    const abort = new AbortController();
    abort.abort();
    expect(await fresh.driver.execute(fresh.driver.command("start"), abort.signal)).toMatchObject({
      kind: "uncertain",
    });
    expect((await fresh.driver.begin()).state.resumed).toBe(false);
  });
  it("continues after ordinary publication closure, completes seven levels once and separates abandonment", async () => {
    const { driver, clock, definition } = setup();
    await driver.begin();
    clock.set(Date.parse(definition.challenge.availableUntil) + 1000);
    for (let index = 0; index < 7; index++) {
      await driver.open(index);
      for (const action of correctActions(resolvedFor(definition, index)))
        await driver.action(action, index);
    }
    const result = await driver.issue("complete");
    expect(result.state).toMatchObject({ score: 100, phase: "results" });
    expect(result.effect === "completed" && result.review?.length).toBe(7);
    expect((await driver.issue("complete")).state.score).toBe(100);
    const abandoned = setup();
    await abandoned.driver.begin();
    await abandoned.driver.open();
    expect(await abandoned.driver.issue("abandon")).toMatchObject({
      effect: "completed",
      review: [],
      state: { status: "abandoned", score: 0 },
    });
  });
  it("rejects unsupported mode commands and concurrent stale writes without accepting either twice", async () => {
    const { driver } = setup();
    await driver.begin();
    await driver.open();
    for (const operation of ["alphabetPass", "takeover"] as const)
      expect(await driver.execute(driver.command(operation))).toMatchObject({
        code: "invalid_command",
      });
    const [first, second] = await Promise.all([
      driver.execute(driver.command("answer", { answer: "A" })),
      driver.execute(driver.command("answer", { answer: "B" })),
    ]);
    expect(first.kind).toBe("accepted");
    expect(second).toMatchObject({ kind: "rejected", code: "stale_version" });
  });
});
