import type { QuestionDifficulty } from "@/types/domain/content";
import type { RehearsalBankQuestion } from "@/types/gameplay/rehearsal";
import { compare, exerciseHash } from "./hash";

const ranks: Record<QuestionDifficulty, number> = { easy: 0, medium: 1, hard: 2 };

/** A rectangular minimum-cost matching. Each exercise can fill at most one slot. */
export class RehearsalAssignment {
  readonly slots: readonly { question: RehearsalBankQuestion; exercise: string; cost: number }[][];

  constructor(
    pools: readonly (readonly RehearsalBankQuestion[])[],
    requested: readonly QuestionDifficulty[],
  ) {
    // One distance step outweighs every possible lower-difficulty tie-break combined.
    const scale = 2 * pools.length + 1;
    const hashes = new Map<RehearsalBankQuestion, string>();
    this.slots = pools.map((pool, i) =>
      pool.map((question) => {
        let exercise = hashes.get(question);
        if (!exercise) hashes.set(question, (exercise = exerciseHash(question)));
        return {
          question,
          exercise,
          cost:
            Math.abs(ranks[question.difficulty] - ranks[requested[i]!]) * scale +
            ranks[question.difficulty],
        };
      }),
    );
  }

  minimumCost(start = 0, unavailable: ReadonlySet<string> = new Set()): number {
    const slots = this.slots.slice(start);
    if (!slots.length) return 0;
    const exercises = [...new Set(slots.flatMap((slot) => slot.map((q) => q.exercise)))]
      .filter((key) => !unavailable.has(key))
      .sort(compare);
    if (exercises.length < slots.length) return Infinity;
    const columns = new Map(exercises.map((key, i) => [key, i + 1]));
    const costs = slots.map((slot) => {
      const row = new Array<number>(exercises.length + 1).fill(Infinity);
      for (const q of slot) {
        const column = columns.get(q.exercise);
        if (column !== undefined) row[column] = Math.min(row[column]!, q.cost);
      }
      return row;
    });
    // Hungarian algorithm with forbidden edges represented by infinity.
    const u = new Array<number>(slots.length + 1).fill(0);
    const v = new Array<number>(exercises.length + 1).fill(0);
    const matched = new Array<number>(exercises.length + 1).fill(0);
    const previous = new Array<number>(exercises.length + 1).fill(0);
    for (let row = 1; row <= slots.length; row++) {
      matched[0] = row;
      let column = 0;
      const minimum = new Array<number>(exercises.length + 1).fill(Infinity);
      const visited = new Array<boolean>(exercises.length + 1).fill(false);
      do {
        visited[column] = true;
        const current = matched[column]!;
        let delta = Infinity;
        let next = 0;
        for (let j = 1; j <= exercises.length; j++) {
          if (visited[j]) continue;
          const reduced = costs[current - 1]![j]! - u[current]! - v[j]!;
          if (reduced < minimum[j]!) {
            minimum[j] = reduced;
            previous[j] = column;
          }
          if (minimum[j]! < delta) {
            delta = minimum[j]!;
            next = j;
          }
        }
        if (!Number.isFinite(delta)) return Infinity;
        for (let j = 0; j <= exercises.length; j++) {
          if (visited[j]) {
            u[matched[j]!]! += delta;
            v[j]! -= delta;
          } else minimum[j]! -= delta;
        }
        column = next;
      } while (matched[column] !== 0);
      do {
        const next = previous[column]!;
        matched[column] = matched[next]!;
        column = next;
      } while (column !== 0);
    }
    return Math.max(0, -v[0]!);
  }
}
