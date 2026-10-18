import type { SessionClock } from "@/application/ports/game-session";

export const systemSessionClock: SessionClock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer),
};
