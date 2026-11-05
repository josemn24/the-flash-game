/** Search normalized sequences with matching letter counts. Memoization lasts for this call only. */
export function minimumSwapsForSequences(initial: readonly string[], target: readonly string[]) {
  const memo = new Map<string, number>();
  const visit = (state: string[]): number => {
    const key = state.join("");
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const firstMismatch = state.findIndex((letter, index) => letter !== target[index]);
    if (firstMismatch === -1) return 0;

    let minimum = Number.POSITIVE_INFINITY;
    for (let candidate = firstMismatch + 1; candidate < state.length; candidate += 1) {
      if (
        state[candidate] !== target[firstMismatch] ||
        state[candidate] === target[candidate] ||
        state[candidate] === state[firstMismatch]
      ) {
        continue;
      }
      const next = [...state];
      [next[firstMismatch], next[candidate]] = [next[candidate], next[firstMismatch]];
      minimum = Math.min(minimum, 1 + visit(next));
    }

    memo.set(key, minimum);
    return minimum;
  };

  return visit([...initial]);
}
