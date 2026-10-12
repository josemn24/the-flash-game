/** Storage compatibility defaults; public progress and private solution remain separate. */
export function canonicalPayload(payload: Record<string, unknown>): unknown {
  return {
    ...payload,
    instruction: payload.instruction ?? null,
    hideInstruction: payload.hideInstruction === true,
    objectiveLabel: payload.objectiveLabel ?? null,
    hideObjectiveLabel: payload.hideObjectiveLabel === true,
    completionMessage: payload.completionMessage ?? null,
    boardLabel: payload.boardLabel ?? null,
  };
}
