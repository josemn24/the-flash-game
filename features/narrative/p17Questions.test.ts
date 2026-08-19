import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/data/challenges";
import { replayEscapeMoves } from "@/lib/escape";
import { evaluateAnswer } from "@/lib/scoring";
import { isCompleteZipPath } from "@/lib/zip";

function getP17Questions() {
  const challenge = getChallengeById("tabarnia-challenge-04");
  if (challenge?.mode !== "narrative") throw new Error("Expected narrative challenge");
  return challenge.beats.flatMap((beat) =>
    beat.steps.flatMap((step) => (step.type === "question" ? [step.question] : [])),
  );
}

describe("P-17 proofs", () => {
  it("identifies the Transantarctic Mountains from the Ross Sea context", () => {
    const question = getP17Questions()[0];
    expect(question.type).toBe("multiple-choice");
    if (question.type !== "multiple-choice") throw new Error("Expected multiple choice");

    expect(
      evaluateAnswer({ question, answer: "Cordillera Transantártica", timeUsed: 0 }),
    ).toMatchObject({
      status: "correct",
      points: 10,
    });
    expect(evaluateAnswer({ question, answer: "Montes Ellsworth", timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: -2,
    });
  });

  it("identifies the Antarctic Circle on a southern hemisphere map", () => {
    const question = getP17Questions()[1];
    expect(question.type).toBe("multiple-choice");
    if (question.type !== "multiple-choice") throw new Error("Expected multiple choice");

    expect(
      evaluateAnswer({
        question,
        answer: "Círculo Polar Antártico",
        timeUsed: 0,
      }),
    ).toMatchObject({
      status: "correct",
      points: 10,
    });
    expect(
      evaluateAnswer({ question, answer: "Trópico de Capricornio", timeUsed: 0 }),
    ).toMatchObject({ status: "incorrect", points: -2 });
  });

  it("classifies species by polar region", () => {
    const question = getP17Questions()[2];
    expect(question.type).toBe("classification");
    if (question.type !== "classification") throw new Error("Expected classification");
    const answer = Object.fromEntries(
      question.items.map((item) => [item.label, item.correctCategory]),
    );

    expect(evaluateAnswer({ question, answer, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 12,
    });
    expect(answer["Pingüino emperador"]).toBe("Antártida");
    expect(answer["Oso polar"]).toBe("Ártico");
  });

  it("clears the camp in four moves with the tripod as the target", () => {
    const question = getP17Questions()[3];
    expect(question.type).toBe("escape");
    if (question.type !== "escape") throw new Error("Expected escape");
    const replay = replayEscapeMoves(question, question.referenceSolution);

    expect(question.initialBlocks.find((block) => block.kind === "target")?.id).toBe("tripod");
    expect(question.initialBlocks.some((block) => block.id === "p17")).toBe(false);
    expect(question.referenceSolution).toHaveLength(4);
    expect(replay).toMatchObject({ valid: true, escaped: true, appliedMoves: 4 });
  });

  it("identifies P-17 as the only compatible evidence row", () => {
    const question = getP17Questions()[4];
    expect(question.type).toBe("multiple-choice");
    if (question.type !== "multiple-choice") throw new Error("Expected multiple choice");

    expect(
      question.options.map((answer) => evaluateAnswer({ question, answer, timeUsed: 0 }).status),
    ).toEqual(["correct", "incorrect", "incorrect", "incorrect"]);
  });

  it("reconstructs the unique route through all six named records", () => {
    const question = getP17Questions()[5];
    expect(question.type).toBe("zip");
    if (question.type !== "zip") throw new Error("Expected Zip");

    expect(question.checkpoints.map((checkpoint) => checkpoint.label)).toEqual([
      "Colonia",
      "Primer desvío",
      "Campamento base",
      "Baliza H-3",
      "Nadir",
      "Último registro",
    ]);
    expect(isCompleteZipPath(question, question.solution)).toBe(true);
    expect(
      evaluateAnswer({ question, answer: { path: question.solution }, timeUsed: 0 }),
    ).toMatchObject({ status: "correct", points: 14 });
  });

  it("orders the observations without adding a cause", () => {
    const question = getP17Questions()[6];
    expect(question.type).toBe("ordering");
    if (question.type !== "ordering") throw new Error("Expected ordering");

    expect(evaluateAnswer({ question, answer: question.correctOrder, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 12,
    });
    expect(question.correctOrder.every((step) => !step.includes("porque"))).toBe(true);
  });

  it("selects the valid evidence-based final conclusion", () => {
    const question = getP17Questions()[7];
    expect(question.type).toBe("multiple-choice");
    if (question.type !== "multiple-choice") throw new Error("Expected multiple choice");

    expect(
      evaluateAnswer({
        question,
        answer: question.correctAnswer,
        timeUsed: 0,
      }),
    ).toMatchObject({ status: "correct", points: 18 });
    expect(
      evaluateAnswer({ question, answer: question.options[0], timeUsed: 0 }),
    ).toMatchObject({ status: "incorrect", points: -4 });
  });
});
