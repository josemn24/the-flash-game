import type { GameSessionCommand } from "@/types/contracts/game-session";

/** Stable command identity shared by the in-memory authorities. */
export function localCommandSignature(command: GameSessionCommand): string {
  return JSON.stringify(command, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
        )
      : value,
  );
}

/** Serialize accepted mutations in one process, matching the remote command queue. */
export function createLocalCommandQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = tail.then(work);
    tail = next.catch(() => undefined);
    return next;
  };
}
