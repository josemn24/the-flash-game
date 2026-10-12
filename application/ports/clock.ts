import type { UtcIsoDateTime } from "@/types/domain";

export interface Clock {
  now(): UtcIsoDateTime;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString() as UtcIsoDateTime,
};
