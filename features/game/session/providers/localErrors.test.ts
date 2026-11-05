import { describe, expect, it } from "vitest";
import {
  createMockFlashPopFlashDemoDefinition,
  createMockFlashPopPyramidDemoDefinition,
  createMockFlashPopSurvivalDemoDefinition,
} from "@/infrastructure/mock/localPyramidDefinition";
import { createLocalPyramidSessionProvider } from "./localPyramid";
import { createLocalSurvivalSessionProvider } from "./localSurvival";
import { createLocalFlashSessionProvider } from "./localFlash";
import { compileDefinition, compileSurvivalDefinition } from "./localShared/definition";
import { correctActions, testDictionaries } from "@/test-utils/game-session-conformance/corpus";
import { manualClock, SessionDriver } from "@/test-utils/game-session-conformance/driver";
import { classifyCommandFailure } from "../../competitive/core/commandRecoveryPolicy";

describe("local authority error contracts", () => {
  it.each(["survival", "pyramid"] as const)(
    "preserves premature %s completion as a confirmed rejection",
    async (mode) => {
      const clock = manualClock();
      const pyramid = createMockFlashPopPyramidDemoDefinition();
      const survival = createMockFlashPopSurvivalDemoDefinition();
      const compiled =
        mode === "pyramid" ? compileDefinition(pyramid) : compileSurvivalDefinition(survival);
      const definition = mode === "pyramid" ? pyramid : survival;
      const provider =
        mode === "pyramid"
          ? createLocalPyramidSessionProvider({
              definition: pyramid,
              clock,
              dictionaries: testDictionaries,
            })
          : createLocalSurvivalSessionProvider({
              definition: survival,
              clock,
              dictionaries: testDictionaries,
            });
      const driver = new SessionDriver(
        provider,
        definition.challenge.id,
        compiled.levels.map((level) => level.source.challengeItemId),
      );
      await driver.begin();
      await driver.issue("prepare");
      if (mode === "pyramid") await driver.issue("activate");
      for (const action of correctActions(compiled.levels[0]!.question))
        await driver.issue(action.operation, action.input);
      const revision = driver.revision;
      const failure = await driver.execute(driver.command("complete"));
      expect(failure).toMatchObject({
        code: `${mode}_not_terminal`,
        kind: "rejected",
        retryable: false,
      });
      expect(driver.revision).toBe(revision);
      if (failure.kind === "accepted") throw new Error("Expected rejection");
      expect(
        classifyCommandFailure({
          operation: "complete",
          mode,
          failure,
          hasAttempt: true,
          terminalRecoveryAttempted: false,
          automaticRetries: 0,
          now: clock.now(),
        }).action,
      ).toEqual({ type: "reload-projection", automatic: false });
    },
  );

  it("rejects a local answer predating presentation without consuming its revision or deadline", async () => {
    const definition = createMockFlashPopFlashDemoDefinition();
    const clock = manualClock();
    const provider = createLocalFlashSessionProvider({ definition, clock });
    const driver = new SessionDriver(
      provider,
      definition.challenge.id,
      definition.challenge.slots.map((slot) => slot.id),
    );
    await driver.begin();
    const prepared = await driver.issue("prepare");
    const revision = driver.revision;
    clock.set(Date.parse(prepared.state.presentedAt!) - 1);
    expect(await driver.execute(driver.command("answer", { answer: "A" }))).toMatchObject({
      kind: "rejected",
      code: "request_predates_presentation",
      retryable: false,
    });
    expect(driver.revision).toBe(revision);
    clock.advance(100);
    const same = await driver.issue("prepare");
    expect(same.state.deadlineAt).toBe(prepared.state.deadlineAt);
  });
});
