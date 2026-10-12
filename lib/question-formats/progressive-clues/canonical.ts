/** Storage compatibility defaults; public progress and private solution remain separate. */
export function canonicalPayload(payload: Record<string, unknown>): unknown {
  return {
    clueCount: Array.isArray(payload.clues) ? payload.clues.length : 0,
    cluePenalty: payload.cluePenalty,
  };
}
