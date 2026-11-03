import tabarnia from "@/scripts/fixtures/scenarios/tabarnia-content.json";
import animals from "@/scripts/fixtures/scenarios/tabarnia-alphabet.json";
import { SBR_QUESTIONS } from "@/scripts/fixtures/scenarios/sbr.mjs";
import { BETA_VIP_ALPHABET } from "@/scripts/fixtures/scenarios/betavip-alphabet.mjs";
import {
  BETA_VIP_SURVIVAL,
  betaVipSurvivalQuestions,
} from "@/scripts/fixtures/scenarios/betavip-survival.mjs";
import {
  BETA_VIP_PYRAMID,
  betaVipPyramidQuestions,
} from "@/scripts/fixtures/scenarios/betavip-pyramid.mjs";
import {
  BETA_VIP_ANTIQUITY,
  betaVipAntiquityQuestions,
} from "@/scripts/fixtures/scenarios/betavip-antiquity.mjs";
import {
  BETA_VIP_TIME_TRIAL,
  betaVipTimeTrialQuestions,
} from "@/scripts/fixtures/scenarios/betavip-time-trial.mjs";
import {
  BETA_VIP_CONNECT_PAIRS,
  betaVipConnectPairsQuestions,
} from "@/scripts/fixtures/scenarios/betavip-connect-pairs.mjs";
import { publicMechanics } from "@/lib/rehearsals/generator";
import { activeQuestions } from "@/lib/rehearsals/catalog";
import type {
  RehearsalTemplate,
  RehearsalBankQuestion,
  RehearsalDefinition,
} from "@/types/gameplay/rehearsal";
import { createLocalPyramidSessionProvider } from "@/features/game/session/providers/localPyramid";
import { createLocalFlashSessionProvider } from "@/features/game/session/providers/localFlash";
import { createLocalSurvivalSessionProvider } from "@/features/game/session/providers/localSurvival";
import { createLocalAlphabetSessionProvider } from "@/features/game/session/providers/localAlphabet";
import { createLocalTimeTrialSessionProvider } from "@/features/game/session/providers/localTimeTrial";
import type { SessionClock } from "@/application/ports/game-session";

type Raw = Omit<RehearsalTemplate, "questions"> & {
  questions: (Omit<RehearsalTemplate["questions"][number], "mechanics"> & {
    publicPayload: Record<string, unknown>;
  })[];
};
export function projectTemplate(raw: Raw): RehearsalTemplate {
  return {
    ...raw,
    questions: raw.questions.map(({ publicPayload, ...q }) => ({
      ...q,
      mechanics: publicMechanics(q.type, publicPayload),
    })),
  };
}
type SetupQuestion = Pick<
  RehearsalBankQuestion,
  "type" | "payloadSchemaVersion" | "publicPayload"
> & { timeLimitMs: number; points: number; modeConfig?: Record<string, unknown> };
function setupTemplate(
  meta: {
    slug: string;
    title: string;
    globalTimeLimitMs?: number;
    modeConfig?: Record<string, unknown>;
  },
  mode: RehearsalTemplate["mode"],
  input: readonly unknown[],
) {
  const questions = input as readonly SetupQuestion[];
  return projectTemplate({
    challengeVersionId: meta.slug,
    title: meta.title,
    mode,
    globalTimeLimitMs: meta.globalTimeLimitMs ?? null,
    modeConfig: meta.modeConfig ?? {},
    questions: questions.map((q) => ({
      type: q.type,
      payloadSchemaVersion: q.payloadSchemaVersion,
      publicPayload: { ...q.publicPayload },
      timeLimitMs: q.timeLimitMs,
      points: q.points,
      difficulty: "medium",
      modeConfig: q.modeConfig ?? {},
    })),
  });
}
// Coverage follows the actual setup sources. There are no manually maintained structure profiles.
const betaVipTemplates = [
  setupTemplate(BETA_VIP_PYRAMID, "pyramid", betaVipPyramidQuestions),
  setupTemplate(BETA_VIP_ANTIQUITY, "pyramid", betaVipAntiquityQuestions),
  setupTemplate(BETA_VIP_TIME_TRIAL, "time-trial", betaVipTimeTrialQuestions),
  setupTemplate(BETA_VIP_CONNECT_PAIRS, "time-trial", betaVipConnectPairsQuestions),
  setupTemplate(BETA_VIP_SURVIVAL, "survival", betaVipSurvivalQuestions("coverage-only")),
  setupTemplate(
    { ...BETA_VIP_ALPHABET, slug: BETA_VIP_ALPHABET.definitionSlug },
    "alphabet",
    BETA_VIP_ALPHABET.entries.map((e, i) => ({
      type: "short-text",
      payloadSchemaVersion: 1,
      publicPayload: { question: e.prompt },
      timeLimitMs: BETA_VIP_ALPHABET.questionTimeLimitMs,
      points:
        Math.floor(100 / BETA_VIP_ALPHABET.entries.length) +
        (i < 100 % BETA_VIP_ALPHABET.entries.length ? 1 : 0),
      modeConfig: { letter: e.letter },
    })),
  ),
];
const tabarniaTemplates = [...tabarnia.challenges, animals.challenge].map((c) => {
  const catalog = c.mode === "alphabet" ? animals.questions : tabarnia.questions;
  const config = c.modeConfig as Record<string, unknown>;
  return projectTemplate({
    challengeVersionId: c.slug,
    title: c.title,
    mode: c.mode,
    globalTimeLimitMs: c.mode === "alphabet" ? Number(config.timeLimitMs) : null,
    modeConfig: c.mode === "alphabet" ? {} : config,
    questions: c.items.map((i) => {
      const q = catalog.find((q) => q.slug === i.questionSlug)!;
      const publicPayload: Record<string, unknown> = {
        ...q.publicPayload.payload,
        question: q.publicPayload.prompt,
      };
      if (q.type === "progressive-image")
        publicPayload.revealDurationMs = Number(publicPayload.revealDurationMs) * 1000;
      return {
        type: q.type,
        payloadSchemaVersion: ["progressive-image", "heat-map", "estimation"].includes(q.type)
          ? 2
          : 1,
        difficulty: "medium",
        timeLimitMs: q.publicPayload.timeLimitMs,
        points: i.points,
        modeConfig: i.modeConfig ?? {},
        publicPayload,
      };
    }),
  } as Raw);
});
export const rehearsalTemplates = [
  ...betaVipTemplates,
  setupTemplate({ slug: "sbr", title: "Flash de Tabarnia" }, "flash", SBR_QUESTIONS),
  ...tabarniaTemplates,
];
export function providerFor(
  definition: RehearsalDefinition,
  clock: SessionClock,
  dictionaries: ReadonlyMap<string, ReadonlySet<string>>,
) {
  const options = { clock, dictionaries };
  switch (definition.challenge.mode) {
    case "pyramid":
      return createLocalPyramidSessionProvider({
        ...options,
        definition: definition as Parameters<
          typeof createLocalPyramidSessionProvider
        >[0]["definition"],
      });
    case "flash":
      return createLocalFlashSessionProvider({
        ...options,
        definition: definition as Parameters<
          typeof createLocalFlashSessionProvider
        >[0]["definition"],
      });
    case "survival":
      return createLocalSurvivalSessionProvider({
        ...options,
        definition: definition as Parameters<
          typeof createLocalSurvivalSessionProvider
        >[0]["definition"],
      });
    case "alphabet":
      return createLocalAlphabetSessionProvider({
        ...options,
        definition: definition as Parameters<
          typeof createLocalAlphabetSessionProvider
        >[0]["definition"],
      });
    case "time-trial":
      return createLocalTimeTrialSessionProvider({
        ...options,
        definition: definition as Parameters<
          typeof createLocalTimeTrialSessionProvider
        >[0]["definition"],
      });
  }
}
export function questionTemplate(
  q: RehearsalBankQuestion,
  mode: RehearsalTemplate["mode"],
  bank: readonly RehearsalBankQuestion[],
): RehearsalTemplate {
  const count = mode === "pyramid" ? 7 : 2;
  return {
    challengeVersionId: `bank-test:${q.id}:${mode}`,
    title: "Prueba de contrato",
    mode,
    globalTimeLimitMs: ["alphabet", "time-trial"].includes(mode) ? 150000 : null,
    modeConfig: mode === "survival" ? { lives: 2 } : {},
    questions: Array.from({ length: count }, (_v, i) => {
      const selected =
        mode === "alphabet" && i === 1
          ? bank.find((v) => v.type === "short-text" && v.alphabetLetter !== q.alphabetLetter)!
          : q;
      return {
        type: selected.type,
        payloadSchemaVersion: selected.payloadSchemaVersion,
        difficulty: selected.difficulty,
        timeLimitMs: selected.referenceTimeLimitMs,
        points:
          i === count - 1 ? 100 - Math.floor(100 / count) * (count - 1) : Math.floor(100 / count),
        modeConfig: mode === "alphabet" ? { letter: selected.alphabetLetter } : {},
        mechanics: publicMechanics(selected.type, selected.publicPayload),
      };
    }),
  };
}

/** Isolates the requested exercise in its format while supplying distinct filler slots. */
export function bankQuestionCase(
  q: RehearsalBankQuestion,
  mode: RehearsalTemplate["mode"],
  bank: readonly RehearsalBankQuestion[],
) {
  const count = mode === "pyramid" ? 7 : 2;
  const fillers = activeQuestions(bank).filter(
    (v) =>
      v.id !== q.id &&
      v.modes.includes(mode) &&
      (mode === "alphabet"
        ? v.alphabetLetter !== q.alphabetLetter
        : mode === "time-trial"
          ? v.type === q.type
          : v.type !== q.type),
  );
  const selected = [q, ...fillers.slice(0, count - 1)];
  if (selected.length !== count) throw new Error("bank_test_fillers_missing");
  const template = questionTemplate(q, mode, bank);
  return {
    bank: selected,
    template: {
      ...template,
      questions: selected.map((v, i) => ({
        ...template.questions[i]!,
        type: v.type,
        payloadSchemaVersion: v.payloadSchemaVersion,
        difficulty: v.difficulty,
        timeLimitMs: v.referenceTimeLimitMs,
        modeConfig: mode === "alphabet" ? { letter: v.alphabetLetter } : {},
        mechanics: publicMechanics(v.type, v.publicPayload),
      })),
    },
  };
}
