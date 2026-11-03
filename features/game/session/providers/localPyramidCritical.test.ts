import { expect, it } from "vitest";
import { createLocalPyramidSessionProvider } from "./localPyramid";
import {
  sessionCases,
  definitionFor,
  testDictionaries,
  resolvedFor,
  correctActions,
  exhaustedHashtagActions,
} from "@/test-utils/game-session-conformance/corpus";
import {
  manualClock,
  SessionDriver,
  confirmed,
} from "@/test-utils/game-session-conformance/driver";

function setup(type: string) {
  const definition = definitionFor(sessionCases.find((c) => c.document.type === type)!);
  const clock = manualClock();
  const provider = createLocalPyramidSessionProvider({
    definition,
    clock,
    dictionaries: testDictionaries,
  });
  const driver = new SessionDriver(
    provider,
    definition.challenge.id,
    definition.challenge.levels.map((l) => l.id),
  );
  return { definition, clock, driver, question: resolvedFor(definition) };
}
it("Connect pairs distinguishes an untouched board from an accepted empty checkpoint", async () => {
  const { driver, question } = setup("connect-pairs");
  await driver.begin();
  expect((await driver.issue("prepare")).state.progress).toBeNull();
  await driver.issue("activate");
  const checkpoint = driver.command("connectPairsDraft", { paths: {} });
  const saved = await driver.execute(checkpoint);
  expect(await driver.execute(checkpoint)).toEqual(saved);
  expect((await driver.issue("prepare")).state.progress).toEqual({
    kind: "connect-pairs",
    paths: {},
  });
  for (const action of correctActions(question)) await driver.action(action);
  expect((await driver.issue("prepare", {}, 1)).state.progress).toBeNull();
});
it("Queens recovery keeps the accepted board in review before the deadline", async () => {
  const { driver, clock, question } = setup("queens");
  if (question.type !== "queens") throw new Error("fixture");
  await driver.begin();
  await driver.open();
  await driver.issue("queensDraft", { queens: question.solution });
  clock.advance(100);
  const recovered = await driver.issue("recover");
  expect(recovered.state.answers).toHaveLength(1);
  expect(recovered.state.answers![0]).toMatchObject({
    answer: null,
    status: "correct",
    points: question.points,
    reviewState: { type: "queens", queens: question.solution },
  });
});
it.each([0, 1, 2])(
  "Queens succeeds after %i failures with the existing weight penalty",
  async (failures) => {
    const { driver, question } = setup("queens");
    if (question.type !== "queens") throw new Error("fixture");
    await driver.begin();
    await driver.open();
    const board = Array.from({ length: question.grid.rows }, (_, i) => i);
    for (let i = 0; i < failures; i++) {
      const result = await driver.issue("queensValidation", { queens: board });
      expect(result).toMatchObject({
        effect: "progress",
        state: { incorrectValidations: i + 1, terminal: false },
      });
    }
    const result = await driver.issue("queensValidation", { queens: question.solution });
    expect(result.state).toMatchObject({ status: "correct", points: 14 - failures });
  },
);
it("Queens drafts and malformed boards never consume validations, and the third failed board ends the ascent", async () => {
  const { driver, question } = setup("queens");
  if (question.type !== "queens") throw new Error("fixture");
  await driver.begin();
  await driver.open();
  const version = driver.revision;
  expect(await driver.execute(driver.command("queensValidation", { queens: [] }))).toMatchObject({
    code: "queens_answer_incomplete",
  });
  expect(await driver.execute(driver.command("queensDraft", { queens: [0, 0] }))).toMatchObject({
    code: "invalid_queens_answer",
  });
  expect(driver.revision).toBe(version);
  const queens = Array.from({ length: question.grid.rows }, (_, i) => i);
  for (let i = 0; i < 3; i++) {
    const draft = await driver.issue("queensDraft", { queens });
    expect(draft.state.incorrectValidations).toBe(i);
    const key = driver.command("queensValidation", { queens });
    const result = await driver.execute(key);
    expect(await driver.execute(key)).toEqual(result);
    expect(confirmed(result).state.incorrectValidations).toBe(i + 1);
  }
  expect((await driver.issue("complete")).state.score).toBe(0);
});
it("Mini-Wordle rejects unknown and duplicate words and exhausts only accepted guesses", async () => {
  const { driver } = setup("mini-wordle");
  await driver.begin();
  await driver.open();
  expect(await driver.execute(driver.command("miniWordleGuess", { guess: "ZZZZZ" }))).toMatchObject(
    { code: "invalid_mini_wordle_guess" },
  );
  await driver.issue("miniWordleGuess", { guess: "Josué" });
  expect(await driver.execute(driver.command("miniWordleGuess", { guess: "JOSUE" }))).toMatchObject(
    { code: "duplicate_mini_wordle_guess" },
  );
  const second = await driver.issue("miniWordleGuess", { guess: "Jacob" });
  expect(second).toMatchObject({ effect: "evaluated", state: { attemptsUsed: 2, points: 0 } });
  expect(await driver.execute(driver.command("miniWordleGuess", { guess: "David" }))).toMatchObject(
    { code: "interaction_not_presented" },
  );
  expect((await driver.issue("complete")).state.score).toBe(0);
});
it("Logic Code rejects repeated codes without changing its accepted history", async () => {
  const { driver } = setup("logic-code");
  await driver.begin();
  await driver.open();
  expect(await driver.execute(driver.command("logicCodeAttempt", { code: "12" }))).toMatchObject({
    code: "invalid_logic_code",
  });
  expect((await driver.issue("logicCodeAttempt", { code: "1111" })).effect).toBe("progress");
  expect(await driver.execute(driver.command("logicCodeAttempt", { code: "1111" }))).toMatchObject({
    code: "duplicate_logic_code",
  });
  expect((await driver.issue("logicCodeAttempt", { code: "0420" })).state).toMatchObject({
    status: "correct",
    points: 13,
    details: { submittedCodes: ["1111", "0420"], incorrectAttempts: 1 },
  });
});
it("Progressive Clues keeps unrevealed clues private and scales the published 100-point penalty", async () => {
  const { driver, question } = setup("progressive-clues");
  if (question.type !== "progressive-clues") throw new Error("fixture");
  await driver.begin();
  const initial = await driver.issue("prepare");
  expect(JSON.stringify(initial)).not.toContain(question.clues[1]!);
  await driver.issue("activate");
  const reveal = await driver.issue("progressiveClueReveal");
  const penalty = Math.max(1, Math.round((question.cluePenalty * 14) / 100));
  expect(reveal.state).toMatchObject({
    revealedClues: 2,
    availablePoints: 14 - penalty,
    cluePenalty: penalty,
  });
  for (let i = 2; i < question.clues.length; i++) await driver.issue("progressiveClueReveal");
  expect(await driver.execute(driver.command("progressiveClueReveal"))).toMatchObject({
    code: "all_clues_revealed",
  });
});
it("Word Search tracks accepted selections, rejects duplicates and preserves partial progress during recovery", async () => {
  const { driver, question } = setup("word-search");
  if (question.type !== "word-search") throw new Error("fixture");
  await driver.begin();
  await driver.open();
  expect(
    (await driver.issue("wordSearchSelection", { startCell: 0, endCell: 1 })).state,
  ).toMatchObject({ correct: false, incorrectAttempts: 1 });
  const target = question.targets[0]!;
  const data = { startCell: target.startCell, endCell: target.endCell };
  expect((await driver.issue("wordSearchSelection", data)).effect).toBe("progress");
  expect(await driver.execute(driver.command("wordSearchSelection", data))).toMatchObject({
    code: "word_search_target_already_found",
  });
  expect(
    confirmed(await driver.execute(driver.command("recover"))).state.answers?.[0],
  ).toMatchObject({ status: "partial", points: 0, details: { foundWords: 1 } });
});
it("Word Hashtag rejects illegal swaps and reconstructs accepted moves during recovery", async () => {
  const { driver, question } = setup("word-hashtag");
  await driver.begin();
  await driver.open();
  expect(
    await driver.execute(driver.command("wordHashtagSwap", { fromCell: 0, toCell: 0 })),
  ).toMatchObject({ code: "invalid_word_hashtag_swap" });
  const first = correctActions(question)[0]!;
  await driver.action(first);
  const result = await driver.issue("recover");
  expect(result.state.answers?.[0]?.answer).toEqual({ swaps: [first.input] });
});
it("a pending receipt recovered after its deadline retains the original answer and reception time", async () => {
  const { driver, clock } = setup("multiple-choice");
  await driver.begin();
  await driver.open();
  clock.advance(1000);
  const abort = new AbortController();
  const pending = driver.execute(driver.command("answer", { answer: "A" }), abort.signal);
  await Promise.resolve();
  abort.abort();
  expect(await pending).toMatchObject({ kind: "uncertain" });
  clock.advance(1000000);
  await driver.issue("start");
  const result = await driver.issue("recover");
  expect(result.state.answers?.[0]).toMatchObject({ answer: "A", status: "correct", timeUsed: 1 });
});

it("Word Hashtag exhausts legal moves without solving the board", async () => {
  const { driver, question } = setup("word-hashtag");
  if (question.type !== "word-hashtag") throw new Error("fixture");
  await driver.begin();
  await driver.open();
  let result;
  for (const action of exhaustedHashtagActions(question)) result = await driver.action(action);
  expect(result).toMatchObject({ effect: "evaluated", state: { points: 0, movesRemaining: 0 } });
  expect((await driver.issue("complete")).state.score).toBe(0);
});
