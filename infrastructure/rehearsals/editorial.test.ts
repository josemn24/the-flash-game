import { expect, it } from "vitest";
import { rehearsalBank } from "./bank";
import { SBR_QUESTIONS } from "@/scripts/fixtures/scenarios/sbr.mjs";
import { BETA_VIP_ALPHABET } from "@/scripts/fixtures/scenarios/betavip-alphabet.mjs";
import { betaVipSurvivalQuestions } from "@/scripts/fixtures/scenarios/betavip-survival.mjs";
import { betaVipPyramidQuestions } from "@/scripts/fixtures/scenarios/betavip-pyramid.mjs";
import { betaVipAntiquityQuestions } from "@/scripts/fixtures/scenarios/betavip-antiquity.mjs";
import { betaVipTimeTrialQuestions } from "@/scripts/fixtures/scenarios/betavip-time-trial.mjs";
import { betaVipConnectPairsQuestions } from "@/scripts/fixtures/scenarios/betavip-connect-pairs.mjs";
import tabarnia from "@/scripts/fixtures/scenarios/tabarnia-content.json";
import tabarniaAlphabet from "@/scripts/fixtures/scenarios/tabarnia-alphabet.json";
import { TABARNIA_FICTION_ALPHABET } from "@/scripts/fixtures/scenarios/tabarnia-multiverse.mjs";

// Official fixtures are read only by this editorial regression, never by the bank or builder.
it("does not repeat official statements or meaningful exact text answers in its initial content", () => {
  const official: {
    publicPayload: Record<string, unknown>;
    solutionPayload: Record<string, unknown>;
  }[] = [
    ...SBR_QUESTIONS,
    ...[...tabarnia.questions, ...tabarniaAlphabet.questions].map((q) => ({
      publicPayload: q.publicPayload,
      solutionPayload: q.privatePayload.solution.payload,
    })),
    ...TABARNIA_FICTION_ALPHABET.entries.map((entry) => ({
      publicPayload: { question: entry.prompt },
      solutionPayload: { correctAnswer: entry.correctAnswer },
    })),
    ...betaVipSurvivalQuestions("audit-only"),
    ...betaVipPyramidQuestions,
    ...betaVipAntiquityQuestions,
    ...betaVipTimeTrialQuestions,
    ...betaVipConnectPairsQuestions,
    ...BETA_VIP_ALPHABET.entries.map((entry) => ({
      publicPayload: { question: entry.prompt },
      solutionPayload: { correctAnswer: entry.correctAnswer },
    })),
  ];
  const normalize = (text: unknown) =>
    String(text)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toLowerCase();
  const prompts = new Set(
    official.map((q) => normalize(q.publicPayload.question ?? q.publicPayload.prompt)),
  );
  // Booleans, digits and tiny labels necessarily overlap. Semantic difficulty still needs editorial review.
  const answers = new Set(
    official
      .map((q) => q.solutionPayload.correctAnswer)
      .filter((a) => typeof a === "string" && a.length >= 4)
      .map(normalize),
  );
  for (const q of rehearsalBank()) {
    expect.soft(prompts.has(normalize(q.publicPayload.question)), q.id).toBe(false);
    const answer = q.solutionPayload?.correctAnswer;
    if (typeof answer === "string" && answer.length >= 4)
      expect.soft(answers.has(normalize(answer)), `${q.id}: ${answer}`).toBe(false);
  }
});
