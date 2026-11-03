import { createHash } from "node:crypto";
import type { RehearsalBankQuestion } from "@/types/gameplay/rehearsal";

export const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function canonical(value: unknown, normalizeText = false): unknown {
  if (typeof value === "string") return normalizeText ? value.normalize("NFC") : value;
  if (Array.isArray(value)) return value.map((v) => canonical(v, normalizeText));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => compare(a, b))
        .map(([k, v]) => [k, canonical(v, normalizeText)]),
    );
  return value;
}

/** Canonical full-version fingerprint used by recipes and the publication ledger. */
export const rehearsalHash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");

/** Editorial metadata and explanations cannot make an identical exercise new. */
export function exerciseHash(question: RehearsalBankQuestion) {
  const solution = Object.fromEntries(
    Object.entries(question.solutionPayload).filter(([key]) => key !== "explanation"),
  );
  return rehearsalHash(
    canonical({ type: question.type, publicPayload: question.publicPayload, solution }, true),
  );
}
