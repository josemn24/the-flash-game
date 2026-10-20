import "server-only";
import { createHash } from "node:crypto";
import content from "@/data/rehearsals/catalog.v1.json";
import { readStoredQuestion } from "@/lib/question-formats/storedRegistry";
import { rehearsalCompatibility } from "@/lib/rehearsals/structure";
import type { JsonValue, DurationMs } from "@/types/domain/values";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type {
  RehearsalArtifact,
  RehearsalDefinition,
  RehearsalMode,
  RehearsalRef,
  RehearsalSource,
} from "@/types/gameplay/rehearsal";

export function listRehearsals(): RehearsalArtifact[] {
  return content.rehearsals.map((template) => {
    const questions = template.items.map((item) => {
      const question = content.questions.find(
        (q) => q.id === item.questionId && q.version === item.questionVersion,
      );
      if (!question) throw new Error(`rehearsal_question_missing:${item.questionId}`);
      return { ...question, ...item };
    });
    const mode = template.mode as RehearsalMode;
    const id = `${template.id}:v${template.version}`;
    const source: RehearsalSource = {
      mode,
      globalTimeLimitMs: template.globalTimeLimitMs,
      modeConfig: template.modeConfig,
      questions: questions.map((q) => ({
        type: q.type as CompetitiveQuestionType,
        payloadSchemaVersion: q.payloadSchemaVersion,
        timeLimitMs: q.timeLimitMs,
        points: q.points,
        modeConfig: q.modeConfig,
        publicPayload: q.publicPayload,
        solutionPayload: q.solutionPayload,
      })),
    };
    const levels = source.questions.map((q, index) => ({
      challengeItemId: `${id}:${index + 1}`,
      payloadSchemaVersion: q.payloadSchemaVersion,
      ...readStoredQuestion({
        questionType: q.type,
        payloadSchemaVersion: q.payloadSchemaVersion,
        publicPayload: q.publicPayload as JsonValue,
        solutionPayload: q.solutionPayload as JsonValue,
        timeLimitMs: q.timeLimitMs as DurationMs,
        itemPoints: q.points,
        receiptId: `${id}:${index + 1}`,
        questionVersionId:
          `${questions[index]!.id}:v${questions[index]!.version}` as QuestionVersionId,
        mode,
        itemConfigSchemaVersion: 1,
        modeConfigSchemaVersion: 1,
        itemConfig: q.modeConfig as JsonValue,
        modeConfig: source.modeConfig as JsonValue,
        publicRepresentation: "authorized-runtime",
      }),
    }));
    const slots = source.questions.map((q, index) => ({
      id: levels[index]!.challengeItemId,
      position: index + 1,
      questionType: q.type,
      payloadSchemaVersion: q.payloadSchemaVersion,
      timeLimitMs: q.timeLimitMs,
      points: q.points,
    }));
    const base = {
      id,
      definitionId: template.id,
      number: 1,
      title: template.title,
      subtitle: "Partida de prueba",
      description:
        "Mismas reglas, otras preguntas. No consume tu intento ni cuenta para el ranking.",
      mode,
      maxScore: 100,
    };
    const challenge =
      mode === "pyramid"
        ? {
            ...base,
            attemptVersion: template.version,
            availableFrom: "1970-01-01T00:00:00.000Z",
            availableUntil: "9999-12-31T23:59:59.999Z",
            levels: slots.map((slot, index) => ({
              ...slot,
              levelId: `${id}:level:${index + 1}`,
              label: `Nivel ${index + 1}`,
              briefing: {
                title: `Nivel ${index + 1}`,
                format: slot.questionType,
                description: "Resuelve esta prueba para continuar el ascenso.",
              },
            })),
          }
        : mode === "alphabet"
          ? {
              ...base,
              timeLimitMs: template.globalTimeLimitMs,
              entries: slots.map((slot, index) => ({
                ...slot,
                letter: source.questions[index]!.modeConfig.letter,
              })),
            }
          : {
              ...base,
              slots,
              ...(mode === "survival" ? { lives: source.modeConfig.lives } : {}),
              ...(mode === "time-trial" ? { timeLimitMs: template.globalTimeLimitMs } : {}),
            };
    return {
      ref: {
        id: template.id,
        version: template.version,
        contentHash: createHash("sha256")
          .update(JSON.stringify({ template, questions }))
          .digest("hex"),
      },
      title: template.title,
      source,
      definition: { challenge, levels } as RehearsalDefinition,
    };
  });
}

export function resolveRehearsal(ref: RehearsalRef): RehearsalArtifact | null {
  return (
    listRehearsals().find(
      (a) =>
        a.ref.id === ref.id &&
        a.ref.version === ref.version &&
        a.ref.contentHash === ref.contentHash,
    ) ?? null
  );
}
export function rehearsalChoices(source: RehearsalSource) {
  return listRehearsals().map((a) => ({
    ref: a.ref,
    title: a.title,
    issues: rehearsalCompatibility(source, a.source),
  }));
}
