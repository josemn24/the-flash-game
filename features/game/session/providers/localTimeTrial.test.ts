import { describe, expect, it } from "vitest";
import { createTimeTrialTestDefinition } from "@/test-utils/game-session-conformance/timeTrialDefinition";
import {
  confirmed,
  manualClock,
  SessionDriver,
} from "@/test-utils/game-session-conformance/driver";
import { createLocalTimeTrialSessionProvider } from "./localTimeTrial";
import { compileTimeTrialDefinition } from "./localShared/definition";

function setup(definition = createTimeTrialTestDefinition()) {
  const clock = manualClock();
  const provider = createLocalTimeTrialSessionProvider({
    definition,
    clock,
    createSessionId: () => "local-time-trial-session",
  });
  const driver = new SessionDriver(
    provider,
    definition.challenge.id,
    definition.challenge.slots.map((slot) => slot.id),
  );
  return { definition, clock, provider, driver };
}

describe("local Time Trial authority", () => {
  it("exposes Connect pairs progress only after accepting a checkpoint", async () => {
    const { driver } = setup(createTimeTrialTestDefinition({ format: "connect-pairs" }));
    await driver.begin();
    expect((await driver.issue("prepare")).state.progress).toBeNull();
    await driver.issue("connectPairsDraft", { paths: {} });
    expect((await driver.issue("prepare")).state.progress).toEqual({
      kind: "connect-pairs",
      paths: {},
    });
  });
  it.each([
    createTimeTrialTestDefinition({ format: "queens" }),
    createTimeTrialTestDefinition({ format: "connect-pairs" }),
  ])("validates a homogeneous local format and its private solutions", (definition) => {
    const compiled = compileTimeTrialDefinition(definition);
    expect(compiled.levels).toHaveLength(2);
    expect(new Set(compiled.levels.map((level) => level.question.type)).size).toBe(1);
    expect(compiled.definition.challenge.timeLimitMs).toBe(120_000);
  });

  it("keeps the global deadline across Queens boards and returns a private terminal review", async () => {
    const { definition, clock, driver } = setup();
    const compiled = compileTimeTrialDefinition(definition);
    await driver.begin();
    const first = await driver.issue("prepare", {}, 0);
    const sharedDeadline = first.state.deadlineAt;
    expect(first.state.timeTrial?.endReason).toBeNull();
    expect(JSON.stringify(first)).not.toMatch(/solution|explanation/);

    // The board's one-second limit is presentation metadata; only the two-minute clock is terminal.
    clock.advance(2_000);
    const firstAction = compiled.levels[0]!.question;
    if (firstAction.type !== "queens") throw new Error("expected Queens fixture");
    const firstResult = await driver.issue("queensValidation", { queens: firstAction.solution }, 0);
    expect(firstResult).toMatchObject({ effect: "evaluated", state: { status: "correct" } });

    const second = await driver.issue("prepare", {}, 1);
    expect(second.state.deadlineAt).toBe(sharedDeadline);
    clock.advance(2_000);
    const secondAction = compiled.levels[1]!.question;
    if (secondAction.type !== "queens") throw new Error("expected Queens fixture");
    const command = driver.command("queensValidation", { queens: secondAction.solution }, 1);
    const result = confirmed(await driver.execute(command));
    expect(confirmed(await driver.execute(command))).toEqual(result);
    expect(result).toMatchObject({ effect: "evaluated", state: { status: "correct" } });

    const completed = await driver.issue("complete");
    expect(completed).toMatchObject({
      effect: "completed",
      state: {
        phase: "results",
        score: 100,
        terminalReason: "all_solved",
        timeTrial: { endReason: "all_solved", solvedCount: 2, totalCount: 2 },
      },
    });
    if (completed.effect !== "completed") throw new Error("expected terminal review");
    expect(completed.review).toHaveLength(2);
    expect(completed.review?.[0]?.solutionPayload).toBeTruthy();
  });

  it("finishes Queens after three incorrect validations without applying local penalties", async () => {
    const { driver } = setup();
    await driver.begin();
    await driver.issue("prepare", {}, 0);
    const badQueens = [0, 2, 9, 15, 20];
    await driver.issue("queensValidation", { queens: badQueens }, 0);
    await driver.issue("queensValidation", { queens: badQueens }, 0);
    const last = await driver.issue("queensValidation", { queens: badQueens }, 0);
    expect(last).toMatchObject({
      effect: "evaluated",
      state: { status: "incorrect", timeTrial: { endReason: "validation_limit" } },
    });

    const completed = await driver.issue("complete");
    expect(completed.state).toMatchObject({ score: 0, terminalReason: "validation_limit" });
    if (completed.effect !== "completed") throw new Error("expected terminal review");
    expect(completed.review).toHaveLength(1);
  });

  it("closes the active board as unanswered at the global deadline and limits review to reached boards", async () => {
    const { definition, clock, driver } = setup();
    await driver.begin();
    const prepared = await driver.issue("prepare", {}, 0);
    clock.set(Date.parse(prepared.state.deadlineAt!));

    const completed = await driver.issue("complete");
    expect(completed).toMatchObject({
      effect: "completed",
      state: {
        terminalReason: "time_limit",
        answers: [{ status: "unanswered", points: 0 }],
        timeTrial: { endReason: "time_limit", elapsedTimeMs: definition.challenge.timeLimitMs },
      },
    });
    expect(completed.state.answers?.[0]).not.toHaveProperty("details");
    if (completed.effect !== "completed") throw new Error("expected terminal review");
    expect(completed.review).toHaveLength(1);
  });

  it.each([
    { weight: 15, placed: [], expected: 0 },
    { weight: 15, placed: [10], expected: 5 },
    { weight: 15, placed: [0, 10, 18], expected: 10 },
    { weight: 14, placed: [10, 18], expected: 9 },
  ])(
    "awards $expected/$weight from the last accepted Queens checkpoint",
    async ({ weight, placed, expected }) => {
      const definition = createTimeTrialTestDefinition({ queensTimeoutPartialCredit: true });
      const { clock, driver } = setup({
        ...definition,
        challenge: {
          ...definition.challenge,
          slots: definition.challenge.slots.map((slot, index) => ({
            ...slot,
            points: index === 0 ? weight : 100 - weight,
          })),
        },
      });
      await driver.begin();
      const prepared = await driver.issue("prepare");
      await driver.issue("queensDraft", { queens: [2, 9, ...placed] });
      clock.set(Date.parse(prepared.state.deadlineAt!));

      const completed = await driver.issue(weight === 14 ? "recover" : "complete");
      expect(completed.state).toMatchObject({
        score: expected,
        terminalReason: "time_limit",
        timeTrial: { solvedCount: 0, points: expected },
        answers: [
          {
            status: expected > 0 ? "partial" : "unanswered",
            answer: null,
            points: expected,
            isCorrect: false,
          },
        ],
      });
    },
  );

  it.each([
    { format: "queens", partial: true },
    { format: "queens", partial: false },
    { format: "connect-pairs", partial: true },
    { format: "connect-pairs", partial: false },
  ] as const)(
    "credits the seventh $format board saved 68 ms before expiry (partial credit: $partial)",
    async ({ format, partial }) => {
      const base = createTimeTrialTestDefinition({
        format,
        globalTimeLimitMs: 150_000,
        queensTimeoutPartialCredit: format === "queens" && partial,
        connectPairsTimeoutPartialCredit: format === "connect-pairs" && partial,
      });
      const slots = [12, 13, 13, 14, 15, 16, 17].map((points, index) => ({
        ...base.challenge.slots[index % base.challenge.slots.length]!,
        id: `board-${index + 1}`,
        position: index + 1,
        points,
      }));
      const { clock, driver, definition } = setup({
        challenge: { ...base.challenge, slots },
        levels: slots.map((slot, index) => ({
          ...base.levels[index % base.levels.length]!,
          challengeItemId: slot.id,
        })),
      });
      const { levels } = compileTimeTrialDefinition(definition);
      await driver.begin();
      for (let index = 0; index < 6; index++) {
        await driver.issue("prepare", {}, index);
        const { question } = levels[index]!;
        if (question.type === "queens")
          await driver.issue("queensValidation", { queens: question.solution }, index);
        else if (question.type === "connect-pairs")
          await driver.issue("answer", { answer: { paths: question.solutionPaths } }, index);
        else throw new Error("Expected a time-trial board");
      }
      const prepared = await driver.issue("prepare", {}, 6);
      expect(prepared.state.timeTrial?.points).toBe(83);
      const deadline = Date.parse(prepared.state.deadlineAt!);
      clock.set(deadline - 68);
      const { question } = levels[6]!;
      if (question.type === "queens")
        await driver.issue("queensDraft", { queens: question.solution }, 6);
      else if (question.type === "connect-pairs")
        await driver.issue("connectPairsDraft", { paths: question.solutionPaths }, 6);
      else throw new Error("Expected a time-trial board");
      clock.set(deadline + 1_103);

      const completed = await driver.issue("recover");
      expect(completed.state).toMatchObject({
        score: 100,
        terminalReason: "all_solved",
        timeTrial: { solvedCount: 7, lastCorrectElapsedMs: 150_000, elapsedTimeMs: 150_000 },
      });
      expect(completed.state.answers?.[6]).toMatchObject({
        answer: null,
        status: "correct",
        points: 17,
        isCorrect: true,
        reviewState: { type: format },
      });
      expect((await driver.issue("complete")).state).toEqual(completed.state);
    },
  );

  it.each(["connect-pairs", "queens"] as const)(
    "keeps the latest %s board for review when the global clock expires",
    async (format) => {
      const definition = createTimeTrialTestDefinition({ format });
      const { clock, driver } = setup(definition);
      const compiled = compileTimeTrialDefinition(definition);
      await driver.begin();
      const prepared = await driver.issue("prepare", {}, 0);
      const question = compiled.levels[0]!.question;
      if (format === "connect-pairs") {
        if (question.type !== "connect-pairs") throw new Error("expected Connect Pairs fixture");
        const pair = question.pairs[0]!;
        await driver.issue(
          "connectPairsDraft",
          {
            paths: { [pair.id]: [pair.endpoints[0]] },
          },
          0,
        );
      } else {
        if (question.type !== "queens") throw new Error("expected Queens fixture");
        const prefilled = question.prefilledQueens ?? [];
        const added = question.solution.find((cell) => !prefilled.includes(cell));
        if (added === undefined) throw new Error("expected an unfilled Queens cell");
        await driver.issue("queensDraft", { queens: [...prefilled, added] }, 0);
      }
      clock.set(Date.parse(prepared.state.deadlineAt!));

      const completed = await driver.issue("complete");

      expect(completed.state.answers?.[0]).toMatchObject({
        answer: null,
        status: "unanswered",
        points: 0,
        reviewState: format === "connect-pairs" ? { type: "connect-pairs" } : { type: "queens" },
      });
      if (format === "connect-pairs")
        expect(completed.state.answers?.[0]?.reviewState).toMatchObject({
          type: "connect-pairs",
          paths: expect.any(Object),
        });
      else
        expect(completed.state.answers?.[0]?.reviewState).toMatchObject({
          type: "queens",
          queens: expect.any(Array),
        });
    },
  );

  it.each([
    { name: "open routes", paths: { a: [0, 1, 2] }, pairs: 0, cells: 0, points: 0 },
    {
      name: "closed routes in either direction",
      paths: { a: [3, 2, 1, 0], b: [4, 9, 8, 7], c: [6, 5, 10, 11], d: [12, 13, 14, 19] },
      pairs: 3,
      cells: 12,
      points: 7,
    },
    {
      name: "all pairs with holes",
      paths: {
        a: [0, 1, 2, 3],
        b: [4, 9, 8, 7],
        c: [6, 5, 10, 11],
        d: [12, 13, 18],
        e: [17, 22, 23, 24],
      },
      pairs: 5,
      cells: 19,
      points: 11,
    },
  ])("scores $name at expiry", async ({ paths, pairs, cells, points }) => {
    const definition = createTimeTrialTestDefinition({
      format: "connect-pairs",
      connectPairsTimeoutPartialCredit: true,
    });
    const { driver, clock } = setup(definition);
    await driver.begin();
    const prepared = await driver.issue("prepare");
    await driver.issue("connectPairsDraft", { paths });
    clock.set(Date.parse(prepared.state.deadlineAt!));
    const finished = await driver.issue("recover");
    expect(finished.state).toMatchObject({
      score: points,
      terminalReason: "time_limit",
      timeTrial: { solvedCount: 0 },
      answers: [
        {
          status: points ? "partial" : "unanswered",
          isCorrect: false,
          points,
          details: {
            type: "connect-pairs",
            timeoutPartialCredit: true,
            connectedPairs: pairs,
            coveredCells: cells,
          },
          reviewState: { type: "connect-pairs", paths },
        },
      ],
    });
  });

  it("evaluates Connect Pairs answers through the canonical scorer", async () => {
    const definition = createTimeTrialTestDefinition({ format: "connect-pairs" });
    const { clock, driver } = setup(definition);
    const compiled = compileTimeTrialDefinition(definition);
    await driver.begin();
    const firstPrepared = await driver.issue("prepare", {}, 0);
    clock.advance(1_200);
    const firstQuestion = compiled.levels[0]!.question;
    if (firstQuestion.type !== "connect-pairs") throw new Error("expected Connect Pairs fixture");
    const firstResult = await driver.issue(
      "answer",
      { answer: { paths: firstQuestion.solutionPaths } },
      0,
    );
    expect(firstResult.state.status).toBe("correct");

    await driver.issue("prepare", {}, 1);
    clock.advance(1_200);
    const second = compiled.levels[1]!.question;
    if (second.type !== "connect-pairs") throw new Error("expected Connect Pairs fixture");
    const secondResult = await driver.issue(
      "answer",
      { answer: { paths: second.solutionPaths } },
      1,
    );
    expect(secondResult.state.status).toBe("correct");
    expect(secondResult.state.timeTrial?.deadlineAt).toBe(firstPrepared.state.deadlineAt);

    const completed = await driver.issue("complete");
    expect(completed.state).toMatchObject({ score: 100, terminalReason: "all_solved" });
  });
});
