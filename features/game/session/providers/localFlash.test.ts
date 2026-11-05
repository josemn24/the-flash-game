import { describe, expect, it } from "vitest";
import { createMockFlashPopFlashDemoDefinition } from "@/infrastructure/mock/localPyramidDefinition";
import { correctActions } from "@/test-utils/game-session-conformance/corpus";
import {
  confirmed,
  manualClock,
  SessionDriver,
} from "@/test-utils/game-session-conformance/driver";
import { createLocalFlashSessionProvider } from "./localFlash";
import { compileFlashDefinition } from "./localShared/definition";

function setup() {
  const definition = createMockFlashPopFlashDemoDefinition();
  const clock = manualClock();
  const provider = createLocalFlashSessionProvider({
    definition,
    clock,
    createSessionId: () => "flash-local-session",
  });
  const driver = new SessionDriver(
    provider,
    definition.challenge.id,
    definition.challenge.slots.map((slot) => slot.id),
  );
  return { definition, clock, driver };
}

describe("local Flash authority", () => {
  it("plays all 16 canonical questions, continues after a mistake and a timeout, and returns terminal review", async () => {
    const { definition, clock, driver } = setup();
    const compiled = compileFlashDefinition(definition);
    await driver.begin();

    const first = await driver.issue("prepare", {}, 0);
    expect(first.state).toMatchObject({ challengeItemId: definition.challenge.slots[0]!.id });
    const wrong = await driver.issue("answer", { answer: "incorrecta" }, 0);
    expect(wrong.state.status).toBe("incorrect");

    const second = await driver.issue("prepare", {}, 1);
    clock.set(Date.parse(second.state.deadlineAt!));
    const timeout = await driver.issue("answer", { answer: null }, 1);
    expect(timeout.state).toMatchObject({ status: "unanswered", timedOut: true, points: 0 });

    for (let index = 2; index < compiled.levels.length; index++) {
      await driver.issue("prepare", {}, index);
      for (const action of correctActions(compiled.levels[index]!.question))
        await driver.issue(action.operation, action.input, index);
    }

    const completed = await driver.issue("complete");
    expect(completed.effect).toBe("completed");
    expect(completed.state).toMatchObject({ phase: "results", answers: expect.any(Array) });
    const completedAnswers = completed.state.answers ?? [];
    expect(completedAnswers).toHaveLength(16);
    expect(completed.state.score).toBe(
      definition.challenge.maxScore -
        definition.challenge.slots[0]!.points -
        definition.challenge.slots[1]!.points,
    );
    expect(completedAnswers.slice(0, 2).map((answer) => answer.status)).toEqual([
      "incorrect",
      "unanswered",
    ]);
    if (completed.effect !== "completed") throw new Error("expected terminal review");
    expect(completed.review).toHaveLength(16);
    expect((await driver.issue("complete")).state.score).toBe(completed.state.score);
  });

  it("supports the full canonical Flash format mix and keeps answers private until completion", async () => {
    const { definition, driver } = setup();
    const compiled = compileFlashDefinition(definition);
    expect(new Set(compiled.levels.map((level) => level.question.type)).size).toBeGreaterThan(5);

    await driver.begin();
    const prepared = await driver.issue("prepare");
    const serialized = JSON.stringify(prepared);
    for (const secret of ["correctAnswer", "acceptedAnswers", "solution", "correctOrder"])
      expect(serialized).not.toContain(`"${secret}"`);
    expect(prepared).not.toHaveProperty("review");
  });

  it("recovers the active question with the same deadline and resumes its answer", async () => {
    const { definition, clock, driver } = setup();
    await driver.begin();
    const prepared = await driver.issue("prepare");
    const deadlineAt = prepared.state.deadlineAt;
    const presentedAt = prepared.state.presentedAt;

    clock.advance(5_000);
    const recovered = await driver.issue("recover");
    expect(recovered.state).toMatchObject({
      phase: "playing",
      challengeItemId: definition.challenge.slots[0]!.id,
      deadlineAt,
      presentedAt,
    });

    const answer = await driver.issue("answer", { answer: "La cultura china" });
    expect(answer.state.status).toBe("correct");
  });

  it("replays an identical answer idempotently and rejects changed data with the same key", async () => {
    const { definition, driver } = setup();
    await driver.begin();
    await driver.issue("prepare");
    const command = driver.command("answer", { answer: "respuesta incorrecta" });
    const first = confirmed(await driver.execute(command));
    expect(confirmed(await driver.execute(command))).toEqual(first);
    expect(
      await driver.execute({
        ...command,
        input: { ...command.input, answer: "respuesta cambiada" },
      } as typeof command),
    ).toMatchObject({ kind: "rejected", code: "idempotency_conflict" });
    expect(definition.challenge.slots).toHaveLength(16);
  });
});
