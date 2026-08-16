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
  it("accepts only observable mountain references in the progressive image", () => {
    const question = getP17Questions()[0];
    expect(question.type).toBe("progressive-image");
    if (question.type !== "progressive-image") throw new Error("Expected progressive image");

    expect(evaluateAnswer({ question, answer: "la cordillera", timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 10,
    });
    expect(evaluateAnswer({ question, answer: "el mar", timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: 0,
    });
  });

  it("scores the exact trajectory deviation point", () => {
    const question = getP17Questions()[1];
    expect(question.type).toBe("heat-map");
    if (question.type !== "heat-map") throw new Error("Expected heat map");

    expect(evaluateAnswer({ question, answer: question.target, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 10,
    });
    expect(evaluateAnswer({ question, answer: { x: 0.9, y: 0.9 }, timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: 0,
    });
  });

  it("separates observations from unsupported interpretations", () => {
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
    expect(answer["Está enfermo"]).toBe("Interpretación no demostrada");
    expect(answer["P-17 gira hacia el interior"]).toBe("Hecho observado");
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

  it("requires the evidentiary correction for all final-record points", () => {
    const question = getP17Questions()[7];
    expect(question.type).toBe("error-reconstruction");
    if (question.type !== "error-reconstruction") {
      throw new Error("Expected error reconstruction");
    }

    expect(evaluateAnswer({ question, answer: { stepId: "cause" }, timeUsed: 0 })).toMatchObject({
      status: "partial",
    });
    expect(
      evaluateAnswer({
        question,
        answer: {
          stepId: "cause",
          correction: "La causa de la trayectoria no pudo determinarse",
        },
        timeUsed: 0,
      }),
    ).toMatchObject({ status: "correct", points: 18 });
  });
});
