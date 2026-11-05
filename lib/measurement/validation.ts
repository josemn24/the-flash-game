import {
  PRODUCT_EVENT_TYPES,
  type ProductEventInput,
  type ProductRating,
} from "@/types/contracts/product-measurement";

export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const str = (value: unknown) => typeof value === "string";
export function parseEvent(value: unknown): ProductEventInput {
  if (
    !record(value) ||
    Object.keys(value).some(
      (k) =>
        ![
          "eventId",
          "type",
          "roomId",
          "publicationId",
          "attemptId",
          "visitId",
          "occurredAt",
          "appVersion",
        ].includes(k),
    ) ||
    !uuid(value.eventId) ||
    !uuid(value.visitId) ||
    !PRODUCT_EVENT_TYPES.includes(value.type as ProductEventInput["type"]) ||
    typeof value.roomId !== "string" ||
    value.roomId.length < 1 ||
    value.roomId.length > 120 ||
    (value.publicationId !== undefined && !uuid(value.publicationId)) ||
    (value.type === "review_viewed" ? !uuid(value.attemptId) : value.attemptId !== undefined) ||
    !date(value.occurredAt) ||
    !str(value.appVersion) ||
    (value.appVersion as string).length < 1 ||
    (value.appVersion as string).length > 80
  )
    throw new Error("invalid_event");
  return value as ProductEventInput;
}
export function parseRating(value: unknown): ProductRating {
  if (
    !record(value) ||
    Object.keys(value).some(
      (key) => !["eligible", "value", "seasonId", "closesAt"].includes(key),
    ) ||
    typeof value.eligible !== "boolean" ||
    !(
      value.value === null ||
      (Number.isInteger(value.value) && Number(value.value) >= 1 && Number(value.value) <= 5)
    ) ||
    (value.closesAt !== undefined && !date(value.closesAt)) ||
    (value.seasonId !== undefined && !uuid(value.seasonId)) ||
    ((value.eligible || value.value !== null) && !uuid(value.seasonId))
  )
    throw new Error("invalid_measurement_response");
  return value as ProductRating;
}
