/** Storage compatibility defaults; public progress and private solution remain separate. */
export function canonicalPayload(payload: Record<string, unknown>): unknown {
  return {
    ...payload,
    showPieceLabels: typeof payload.showPieceLabels === "boolean" ? payload.showPieceLabels : true,
  };
}
