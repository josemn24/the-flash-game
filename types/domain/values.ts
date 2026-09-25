import type { Brand } from "@/types/domain/identifiers";

export type UtcIsoDateTime = Brand<string, "UtcIsoDateTime">;
export type DurationMs = Brand<number, "DurationMs">;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type EntityTimestamps = {
  readonly createdAt: UtcIsoDateTime;
  readonly updatedAt: UtcIsoDateTime;
};
