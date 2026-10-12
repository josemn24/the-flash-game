/** Storage compatibility defaults; public progress and private solution remain separate. */
export function canonicalPayload(payload: Record<string, unknown>): unknown {
  return {
    hint: payload.hint ?? null,
    wordLength: payload.wordLength,
    maxAttempts: payload.maxAttempts,
  };
}
