/** Storage compatibility defaults; public progress and private solution remain separate. */
export function canonicalPayload(payload: Record<string, unknown>): unknown {
  // Published library payloads may include historical metadata; canonical contracts keep format fields.
  return { grid: payload.grid, regions: payload.regions, prefilledQueens: payload.prefilledQueens };
}
