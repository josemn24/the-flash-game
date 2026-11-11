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
import { createMockFlashPopPyramidDemoDefinition } from "@/infrastructure/mock/localPyramidDefinition";

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

describe("Cumbre lógica Conexiones at the deadline", () => {
  async function atConexiones(enabled = true) {
    const original = createMockFlashPopPyramidDemoDefinition();
    const definition = {
      ...original,
      challenge: { ...original.challenge, connectPairsTimeoutPartialCredit: enabled },
    };
    const clock = manualClock();
    const authority = createLocalPyramidSessionProvider({ definition, clock });
    const driver = new SessionDriver(
      authority,
      definition.challenge.id,
      definition.challenge.levels.map((slot) => slot.id),
    );
    const { levels } = compileDefinition(definition);
    await driver.begin();
    for (const [index, level] of levels.slice(0, 4).entries()) {
      await driver.open(index);
      for (const action of correctActions(level.question)) {
        await driver.action(action, index);
      }
    }
    await driver.open(4);
    const question = levels[4]!.question;
    if (question.type !== "connect-pairs") throw new Error("Expected Conexiones");
    const { circle, diamond, star } = question.solutionPaths;
    const partial = { circle, diamond, star: star.slice(0, 2) };
    return { clock, driver, partial, question };
  }

  it("credits seven points, rejects a draft at the deadline, and closes without a sixth level", async () => {
    const { clock, driver, partial, question } = await atConexiones();
    await driver.issue("connectPairsDraft", { paths: partial }, 4);
    clock.advance(35000);
    expect(
      await driver.execute(
        driver.command("connectPairsDraft", { paths: question.solutionPaths }, 4),
      ),
    ).toMatchObject({ kind: "rejected", code: "deadline_reached" });
    const timeout = driver.command("answer", { answer: { paths: question.solutionPaths } }, 4);
    const evaluation = await driver.execute(timeout);
    expect(evaluation).toMatchObject({
      kind: "accepted",
      state: {
        status: "partial",
        points: 7,
        details: { timeoutPartialCredit: true, connectedPairs: 2, coveredCells: 12 },
        reviewState: { type: "connect-pairs", paths: partial },
      },
    });
    expect(await driver.execute(timeout)).toEqual(evaluation);
    expect(await driver.execute(driver.command("prepare"))).toMatchObject({
      kind: "rejected",
      code: "pyramid_level_failed",
    });
    const completed = await driver.issue("complete");
    expect(completed.state.score).toBe(62);
    expect(completed.state.answers?.at(-1)).toMatchObject({
      status: "partial",
      isCorrect: false,
      points: 7,
    });
    expect(completed.state.answers).toHaveLength(5);
  });

  it.each(["empty", "open", "disabled", "interrupted"] as const)(
    "awards zero for a %s checkpoint",
    async (scenario) => {
      const { clock, driver, partial } = await atConexiones(scenario !== "disabled");
      const paths =
        scenario === "empty" ? {} : scenario === "open" ? { star: partial.star } : partial;
      await driver.issue("connectPairsDraft", { paths }, 4);
      clock.advance(scenario === "interrupted" ? 1 : 35000);
      const recovered = await driver.issue("recover");
      expect(recovered.state.score).toBe(55);
      expect(recovered.state.answers?.at(-1)).toMatchObject({ points: 0, status: "unanswered" });
    },
  );

  it("recovers a solved checkpoint with normal speed points and opens Cerradura", async () => {
    const { clock, driver, question } = await atConexiones();
    clock.advance(17500);
    await driver.issue("connectPairsDraft", { paths: question.solutionPaths }, 4);
    clock.advance(17500);
    const recovered = await driver.issue("recover");
    expect(recovered.state.phase).toBe("briefing");
    expect(recovered.state.answers?.at(-1)).toMatchObject({ status: "correct", points: 12 });
    expect((await driver.issue("prepare")).state.challengeItemId).toBe(driver.itemIds[5]);
  });

  it("gives priority to a timely final answer over a partial draft during recovery", async () => {
    const { clock, driver, partial, question } = await atConexiones();
    await driver.issue("connectPairsDraft", { paths: partial }, 4);
    clock.advance(17500);
    const command = driver.command("answer", { answer: { paths: question.solutionPaths } }, 4);
    const controller = new AbortController();
    const pending = driver.execute(command, controller.signal);
    await Promise.resolve();
    controller.abort();
    expect(await pending).toMatchObject({ kind: "uncertain", code: "request_cancelled" });
    await driver.issue("start");
    clock.advance(17500);
    const recovered = await driver.issue("recover");
    expect(recovered.state.answers?.at(-1)).toMatchObject({ status: "correct", points: 12 });
  });
});

describe("versioned Word Search and Queens timeout credit", () => {
  async function openPartialLevel(format: "word-search" | "queens", enabled = true) {
    const example = sessionCases.find((row) => row.document.type === format)!;
    const original = definitionFor(example);
    const definition = {
      ...original,
      challenge: {
        ...original.challenge,
        [format === "queens" ? "queensTimeoutPartialCredit" : "wordSearchTimeoutPartialCredit"]:
          enabled,
      },
    };
    const { driver, clock } = setup(example, definition);
    const question = resolvedFor(definition);
    await driver.begin();
    await driver.open();
    return { driver, clock, question };
  }

  it("credits only confirmed distinct words on expiry and keeps them in review", async () => {
    const { driver, clock } = await openPartialLevel("word-search");
    await driver.issue("wordSearchSelection", { startCell: 0, endCell: 4 });
    await driver.issue("wordSearchSelection", { startCell: 0, endCell: 3 });
    expect(
      await driver.execute(driver.command("wordSearchSelection", { startCell: 3, endCell: 0 })),
    ).toMatchObject({ code: "word_search_target_already_found" });
    clock.advance(90_000);
    const command = driver.command("recover");
    const result = await driver.execute(command);
    expect(result).toMatchObject({
      effect: "completed",
      state: {
        score: 7,
        answers: [
          {
            status: "partial",
            points: 7,
            isCorrect: false,
            reviewState: { type: "word-search", foundWordIds: ["casa"] },
            details: { timeoutPartialCredit: true, incorrectSelections: 1 },
          },
        ],
      },
    });
    expect(await driver.execute(command)).toEqual(result);
  });

  it.each([true, false])(
    "uses the version rule for a partially solved Queens board (enabled %s)",
    async (enabled) => {
      const { driver, clock, question } = await openPartialLevel("queens", enabled);
      if (question.type !== "queens") throw new Error("Expected Queens");
      await driver.issue("queensDraft", { queens: question.solution.slice(0, 4) });
      clock.advance(90_000);
      if (enabled) {
        expect(
          await driver.execute(driver.command("queensDraft", { queens: question.solution })),
        ).toMatchObject({ code: "deadline_reached" });
      }
      const evaluation = await driver.issue("answer", { answer: null });
      expect(evaluation.state).toMatchObject({ points: enabled ? 8 : 0 });
      if (enabled) {
        expect(evaluation.state).toMatchObject({
          status: "partial",
          details: { timeoutPartialCredit: true, correctPlacements: 3, requiredPlacements: 5 },
        });
      }
      expect(await driver.execute(driver.command("prepare"))).toMatchObject({
        code: "pyramid_level_failed",
      });
    },
  );

  it.each([true, false])(
    "recognizes a saved full Queens board only after expiry (expired %s)",
    async (expired) => {
      const { driver, clock, question } = await openPartialLevel("queens");
      if (question.type !== "queens") throw new Error("Expected Queens");
      const incorrectBoard = [...question.solution.slice(0, -1), 34];
      await driver.issue("queensValidation", { queens: incorrectBoard });
      clock.advance(45_000);
      await driver.issue("queensDraft", { queens: question.solution });
      clock.advance(expired ? 45_000 : 100);
      const recovered = await driver.issue("recover");
      expect(recovered.state.answers?.[0]).toMatchObject({
        status: expired ? "correct" : "unanswered",
        points: expired ? 10 : 0,
        reviewState: { type: "queens", queens: question.solution },
      });
      if (expired)
        expect((await driver.issue("prepare")).state.challengeItemId).toBe(driver.itemIds[1]);
      else expect(recovered.effect).toBe("completed");
    },
  );
  it("recognizes an explicitly saved complete board with all Queens fixed", async () => {
    const example = sessionCases.find((row) => row.document.type === "queens")!;
    const original = definitionFor(example);
    const [first, ...rest] = original.levels;
    const question = resolvedFor(original);
    if (question.type !== "queens" || first?.publicQuestion.type !== "queens")
      throw new Error("Expected Queens");
    const { clock, driver } = setup(example, {
      challenge: { ...original.challenge, queensTimeoutPartialCredit: true },
      levels: [
        {
          ...first,
          publicQuestion: {
            ...first.publicQuestion,
            payload: { ...first.publicQuestion.payload, prefilledQueens: question.solution },
          },
        },
        ...rest,
      ],
    });
    await driver.begin();
    await driver.open();
    await driver.issue("queensDraft", { queens: [] });
    clock.advance(90_000);
    expect((await driver.issue("answer", { answer: null })).state).toMatchObject({
      status: "correct",
      points: 14,
      reviewState: { type: "queens", queens: question.solution },
    });
  });
});

describe("Pyramid credit for matching, classification and ordering", () => {
  const cases = [
    {
      format: "matching",
      key: "matchingPartialCredit",
      draft: { l1: "r1" },
      submission: { l1: "r1", l2: "r3", l3: "r2" },
      zeroAnswer: { l1: "r2", l2: "r3", l3: "r1" },
      solved: { l1: "r1", l2: "r2", l3: "r3" },
      points: 4,
    },
    {
      format: "classification",
      key: "classificationPartialCredit",
      draft: { Brújula: "útil en 1890" },
      submission: { Brújula: "útil en 1890", "Navegador GPS": "útil en 1890" },
      zeroAnswer: { Brújula: "anacrónico", "Navegador GPS": "útil en 1890" },
      solved: { Brújula: "útil en 1890", "Navegador GPS": "anacrónico" },
      points: 7,
    },
    {
      format: "ordering",
      key: "orderingPartialCredit",
      draft: ["Denver", "San Diego", "Nueva York"],
      submission: ["Nueva York", "Denver", "San Diego"],
      zeroAnswer: ["Denver", "Nueva York", "San Diego"],
      solved: ["San Diego", "Denver", "Nueva York"],
      points: 4,
    },
  ] as const;

  async function open(test: (typeof cases)[number], enabled = true) {
    const example = sessionCases.find((row) => row.document.type === test.format)!;
    const definition = definitionFor(example, { duration: 10_000 });
    const { clock, driver } = setup(example, {
      ...definition,
      challenge: { ...definition.challenge, ...(enabled ? { [test.key]: true } : {}) },
    });
    await driver.begin();
    await driver.open();
    return { clock, driver };
  }

  it.each(cases)("scores a final $format answer ahead of a solved draft", async (test) => {
    const { driver } = await open(test);
    const originalAnswer = driver.command("answer", { answer: test.submission });
    await driver.issue("pyramidDraft", { answer: test.solved });
    const result = await driver.execute(originalAnswer);
    expect(result).toMatchObject({
      effect: "evaluated",
      state: {
        status: "partial",
        points: test.points,
        details: { pyramidPartialCredit: "submission" },
      },
    });
    expect(await driver.execute(originalAnswer)).toEqual(result);
    expect(await driver.execute(driver.command("prepare"))).toMatchObject({
      code: "pyramid_level_failed",
    });
    const completed = await driver.issue("complete");
    expect(completed.state).toMatchObject({
      score: test.points,
      answers: [{ status: "partial", isCorrect: false, answer: test.submission }],
    });
  });

  it.each(cases)("recovers the accepted $format draft after expiry", async (test) => {
    const { clock, driver } = await open(test);
    await driver.issue("pyramidDraft", { answer: test.draft });
    clock.advance(10_000);
    expect(
      await driver.execute(driver.command("pyramidDraft", { answer: test.solved })),
    ).toMatchObject({
      code: "deadline_reached",
    });
    const command = driver.command("recover");
    const result = await driver.execute(command);
    expect(result).toMatchObject({
      effect: "completed",
      state: {
        score: test.points,
        answers: [
          {
            status: "partial",
            isCorrect: false,
            answer: null,
            reviewState: { type: test.format, answer: test.draft },
            details: { pyramidPartialCredit: "timeout" },
          },
        ],
      },
    });
    expect(await driver.execute(command)).toEqual(result);
  });

  it.each(cases)("uses the $format save time for a solved draft", async (test) => {
    const { clock, driver } = await open(test);
    clock.advance(2500);
    await driver.issue("pyramidDraft", { answer: test.solved });
    clock.advance(7500);
    expect((await driver.issue("answer", { answer: null })).state).toMatchObject({
      status: "correct",
      points: 13,
      reviewState: { type: test.format, answer: test.solved },
    });
    expect((await driver.issue("prepare")).state.challengeItemId).toBe(driver.itemIds[1]);
  });

  it.each(cases)("keeps $format partials disabled by default", async (test) => {
    const { driver } = await open(test, false);
    expect(
      await driver.execute(driver.command("pyramidDraft", { answer: test.draft })),
    ).toMatchObject({
      code: "invalid_command",
    });
    expect((await driver.issue("answer", { answer: test.submission })).state.points).toBe(0);
  });

  it.each(cases)("awards zero when $format has no correct elements", async (test) => {
    for (const timedOut of [false, true]) {
      const { driver, clock } = await open(test);
      if (timedOut) {
        await driver.issue("pyramidDraft", { answer: test.zeroAnswer });
        clock.advance(10_000);
      }
      expect(
        (await driver.issue("answer", { answer: timedOut ? null : test.zeroAnswer })).state,
      ).toMatchObject({ status: timedOut ? "unanswered" : "incorrect", points: 0 });
      expect(await driver.execute(driver.command("prepare"))).toMatchObject({
        code: "pyramid_level_failed",
      });
      expect((await driver.issue("complete")).state.score).toBe(0);
    }
  });

  it("awards zero for an unedited order or an early interruption", async () => {
    const test = cases[2];
    const untouched = await open(test);
    untouched.clock.advance(10_000);
    expect((await untouched.driver.issue("recover")).state.score).toBe(0);
    const interrupted = await open(test);
    await interrupted.driver.issue("pyramidDraft", { answer: test.solved });
    expect((await interrupted.driver.issue("recover")).state.score).toBe(0);
  });
});
