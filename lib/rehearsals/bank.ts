import type { RehearsalBankQuestion } from "@/types/gameplay/rehearsal";
import { competitiveCapabilityFor } from "@/lib/question-formats/definitions";
import { readStoredQuestion } from "@/lib/question-formats/storedRegistry";
import type { DurationMs, JsonValue } from "@/types/domain/values";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import { activeQuality } from "./catalog";

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export function validateBank(
  input: readonly RehearsalBankQuestion[],
): readonly RehearsalBankQuestion[] {
  const identities = new Set<string>();
  const bank = structuredClone(input);
  for (const q of bank) {
    const identity = `${q.id}@${q.version}`;
    if (
      !/^[a-z0-9][a-z0-9-]{0,119}$/.test(q.id) ||
      !Number.isSafeInteger(q.version) ||
      q.version < 1 ||
      (q.generationStatus !== undefined && !["active", "retired"].includes(q.generationStatus)) ||
      identities.has(identity) ||
      !["easy", "medium", "hard"].includes(q.difficulty) ||
      !q.modes.length ||
      q.modes.some(
        (mode) => !["flash", "survival", "pyramid", "alphabet", "time-trial"].includes(mode),
      ) ||
      new Set(q.modes).size !== q.modes.length ||
      !Number.isSafeInteger(q.referenceTimeLimitMs) ||
      q.referenceTimeLimitMs <= 0
    )
      throw new Error(`invalid_bank_metadata:${identity}`);
    identities.add(identity);
    if (
      q.modes.includes("alphabet") &&
      (q.type !== "short-text" ||
        !q.alphabetLetter ||
        !/^\p{L}$/u.test(q.alphabetLetter) ||
        !String(q.solutionPayload.correctAnswer)
          .normalize("NFC")
          .toLocaleUpperCase("es")
          .startsWith(q.alphabetLetter.toLocaleUpperCase("es")))
    )
      throw new Error(`invalid_bank_letter:${identity}`);
    function assets(value: unknown) {
      if (value && typeof value === "object")
        for (const [key, child] of Object.entries(value)) {
          if (
            key === "src" &&
            (typeof child !== "string" ||
              !/^\/rehearsals\/v\d+\//.test(child) ||
              child.includes(".."))
          )
            throw new Error(`invalid_bank_asset:${identity}`);
          else assets(child);
        }
    }
    assets(q.publicPayload);
    for (const mode of q.modes) {
      if (
        !competitiveCapabilityFor(q.type, mode)?.payloadSchemaVersions.includes(
          q.payloadSchemaVersion,
        )
      )
        throw new Error(`invalid_bank_mode:${identity}:${mode}`);
      try {
        readStoredQuestion({
          questionType: q.type,
          payloadSchemaVersion: q.payloadSchemaVersion,
          publicPayload: q.publicPayload as JsonValue,
          solutionPayload: q.solutionPayload as JsonValue,
          timeLimitMs: q.referenceTimeLimitMs as DurationMs,
          itemPoints: 100,
          receiptId: identity,
          questionVersionId: identity as QuestionVersionId,
          mode,
          itemConfigSchemaVersion: 1,
          modeConfigSchemaVersion: 1,
          itemConfig: mode === "alphabet" ? { letter: q.alphabetLetter! } : {},
          modeConfig: {},
          publicRepresentation: "authorized-runtime",
        });
      } catch (error) {
        throw new Error(`invalid_bank_question:${identity}:${mode}`, { cause: error });
      }
    }
  }
  const quality = activeQuality(bank);
  if (quality.duplicates.length)
    throw new Error(`duplicate_bank_exercise:${quality.duplicates[0]!.join(":")}`);
  return freeze(bank);
}
