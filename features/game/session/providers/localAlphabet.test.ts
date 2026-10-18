import { describe, expect, it } from "vitest";
import { createMockFlashPopAlphabetDemoDefinition } from "@/infrastructure/mock/localPyramidDefinition";
import { confirmed, manualClock, SessionDriver } from "@/test-utils/game-session-conformance/driver";
import { createLocalAlphabetSessionProvider } from "./localAlphabet";
import { compileAlphabetDefinition } from "./localShared/definition";
import type { ServerAlphabetProgress } from "@/types/gameplay/challenge";
import type { GameSessionCommand } from "@/types/contracts/game-session";

function setup() {
  const definition = createMockFlashPopAlphabetDemoDefinition();
  const clock = manualClock();
  const provider = createLocalAlphabetSessionProvider({
    definition,
    clock,
    createSessionId: () => "local-alphabet-session",
  });
  const driver = new SessionDriver(
    provider,
    definition.challenge.id,
    definition.challenge.entries.map((entry) => entry.id),
  );
  return { definition, clock, provider, driver };
}

describe("local Alphabet authority", () => {
  it("compiles the complete 16-letter fixture with private short-text solutions", () => {
    const definition = createMockFlashPopAlphabetDemoDefinition();
    const compiled = compileAlphabetDefinition(definition);
    expect(compiled.definition.challenge.entries.map((entry) => entry.letter)).toEqual([
      "A", "B", "C", "D", "E", "F", "I", "J", "L", "M", "O", "P", "R", "S", "T", "Z",
    ]);
    expect(compiled.levels).toHaveLength(16);
    expect(compiled.levels.every((level) => level.question.type === "short-text")).toBe(true);
    expect(compiled.definition.challenge.timeLimitMs).toBe(150_000);
  });

  it("prioritizes unseen letters, revisits passed letters, shares the deadline and scores answers", async () => {
    const { definition, clock, driver } = setup();
    const compiled = compileAlphabetDefinition(definition);
    const started = await driver.begin();
    const globalDeadline = started.state.deadlineAt;
    clock.advance(5_000); // The local deadline includes the competitive countdown.

    const first = await driver.issue("prepare");
    expect(first.state.deadlineAt).toBe(globalDeadline);
    expect(first.state.progress).toMatchObject({
      kind: "alphabet",
      round: 1,
      currentIndex: 0,
      playedCount: 1,
    });
    expect((first.state.progress as ServerAlphabetProgress).letters[0]).toMatchObject({
      letter: "A",
      status: "active",
    });
    expect(JSON.stringify(first)).not.toMatch(/solutionPayload|explanation|"correctAnswer"/);

    clock.advance(1_500);
    const passCommand = driver.command("alphabetPass", {}, 0);
    const passed = confirmed(await driver.execute(passCommand));
    expect(passed.state).toMatchObject({
      status: "unanswered",
      timeUsedMs: 1_500,
    });
    expect((passed.state.progress as ServerAlphabetProgress).letters[0]).toMatchObject({
      letter: "A",
      status: "passed",
    });
    expect(confirmed(await driver.execute(passCommand))).toEqual(passed);

    const answerEntry = async (index: number) => {
      const prepared = await driver.issue("prepare", {}, index);
      expect(prepared.state.deadlineAt).toBe(globalDeadline);
      const question = compiled.levels[index]!.question;
      if (question.type !== "short-text") throw new Error("expected short-text fixture");
      clock.advance(1_000);
      return driver.issue("answer", { answer: question.correctAnswer }, index);
    };

    const second = await answerEntry(1);
    expect(second.state.status).toBe("correct");
    for (let index = 2; index < definition.challenge.entries.length; index++) {
      expect((await answerEntry(index)).state.status).toBe("correct");
    }

    const revisit = await driver.issue("prepare", {}, 0);
    expect(revisit.state).toMatchObject({
      challengeItemId: definition.challenge.entries[0]!.id,
      progress: { round: 2, currentIndex: 0, playedCount: 16 },
    });
    const answerA = compiled.levels[0]!.question;
    if (answerA.type !== "short-text") throw new Error("expected short-text fixture");
    clock.advance(1_000);
    const resolvedA = await driver.issue("answer", { answer: answerA.correctAnswer }, 0);
    expect(resolvedA.state.status).toBe("correct");
    expect(resolvedA.state.timeUsedMs).toBe(2_500);

    const completeCommand = driver.command("complete");
    const completed = confirmed(await driver.execute(completeCommand));
    expect(completed.effect).toBe("completed");
    expect(completed.state.phase).toBe("results");
    expect(completed.state.score).toBe(100);
    expect(completed.state.answers).toHaveLength(16);
    expect(confirmed(await driver.execute(completeCommand))).toEqual(completed);
    if (completed.effect !== "completed") throw new Error("expected terminal review");
    expect(completed.review).toHaveLength(16);
    expect(completed.review?.[0]?.solutionPayload).toBeTruthy();
  });

  it("records incorrect answers as zero points and rejects changed payloads for an idempotency key", async () => {
    const { definition, driver, clock } = setup();
    const compiled = compileAlphabetDefinition(definition);
    await driver.begin();
    await driver.issue("prepare");
    clock.advance(2_000);
    const command = driver.command("answer", { answer: "un animal inventado" }, 0);
    const incorrect = confirmed(await driver.execute(command));
    expect(incorrect).toMatchObject({
      effect: "evaluated",
      state: { status: "incorrect", points: 0, timeUsedMs: 2_000 },
    });
    expect(confirmed(await driver.execute(command))).toEqual(incorrect);
    const conflicting = {
      ...command,
      input: { ...command.input, answer: compiled.levels[0]!.question.type === "short-text" ? compiled.levels[0]!.question.correctAnswer : "" },
    } as GameSessionCommand;
    expect(await driver.execute(conflicting)).toMatchObject({
      kind: "rejected",
      code: "idempotency_conflict",
    });
  });

  it("starts the global clock with Start and times out all unresolved letters", async () => {
    const { definition, clock, driver } = setup();
    const started = await driver.begin();
    const startMs = clock.now();
    expect(Date.parse(started.state.deadlineAt!)).toBe(startMs + definition.challenge.timeLimitMs);
    clock.set(Date.parse(started.state.deadlineAt!));

    const prepared = await driver.issue("prepare");
    expect(prepared.state.timedOut).toBe(true);
    const completeCommand = driver.command("complete");
    const completed = confirmed(await driver.execute(completeCommand));
    expect(completed.state).toMatchObject({
      phase: "results",
      score: 0,
      answers: Array(16).fill(expect.objectContaining({ status: "unanswered", points: 0 })),
      progress: { deadlineAt: started.state.deadlineAt },
    });
    if (completed.effect !== "completed") throw new Error("expected terminal review");
    expect(completed.review).toHaveLength(16);
  });

  it("preserves active and passed letter time when the global deadline expires", async () => {
    const { definition, clock, driver } = setup();
    await driver.begin();
    await driver.issue("prepare", {}, 0);
    clock.advance(3_000);
    await driver.issue("alphabetPass", {}, 0);
    await driver.issue("prepare", {}, 1);
    const deadline = Date.parse((await driver.issue("recover")).state.deadlineAt!);
    clock.set(deadline);
    const completed = await driver.issue("complete");
    expect(completed.state.answers).toHaveLength(16);
    expect(completed.state.answers?.[0]).toMatchObject({
      questionId: definition.challenge.entries[0]!.id,
      status: "unanswered",
      timeUsed: 3,
    });
    expect(completed.state.answers?.[1]).toMatchObject({
      questionId: definition.challenge.entries[1]!.id,
      status: "unanswered",
      timeUsed: (definition.challenge.timeLimitMs - 3_000) / 1_000,
    });
  });
});
