/** Storage compatibility defaults; public progress and private solution remain separate. */
export function canonicalPayload(payload: Record<string, unknown>): unknown {
  return { ...payload, directionLabels: payload.directionLabels ?? null };
}
