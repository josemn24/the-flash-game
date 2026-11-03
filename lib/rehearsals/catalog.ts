import type { RehearsalBankQuestion } from "@/types/gameplay/rehearsal";
import { compare, exerciseHash } from "./hash";

export function latestQuestions(bank: readonly RehearsalBankQuestion[]) {
  const entries = new Map<string, RehearsalBankQuestion>();
  for (const q of bank)
    if (!entries.has(q.id) || entries.get(q.id)!.version < q.version) entries.set(q.id, q);
  return [...entries.values()].sort((a, b) => compare(a.id, b.id));
}

export function activeQuestions(bank: readonly RehearsalBankQuestion[]) {
  return latestQuestions(bank).filter((q) => q.generationStatus !== "retired");
}

export function genericExplanation(explanation: unknown) {
  if (typeof explanation !== "string" || !explanation.trim()) return true;
  const text = explanation
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
  return (
    [
      "la solucion de este ejercicio permite revisar como funciona el formato",
      "resuelve el ejercicio siguiendo sus reglas y comprueba la solucion",
    ].some((template) => text.includes(template)) ||
    /^.+ es la respuesta descrita[.!?]*$/.test(text)
  );
}

export function activeQuality(bank: readonly RehearsalBankQuestion[]) {
  const exercises = new Map<string, string[]>();
  const genericExplanations: string[] = [];
  for (const q of activeQuestions(bank)) {
    const hash = exerciseHash(q);
    exercises.set(hash, [...(exercises.get(hash) ?? []), q.id]);
    if (genericExplanation(q.solutionPayload.explanation)) genericExplanations.push(q.id);
  }
  return {
    duplicates: [...exercises.values()].filter((ids) => ids.length > 1),
    genericExplanations,
  };
}
