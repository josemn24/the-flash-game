import type { NormalizedPoint } from "@/types/question";

export const HEAT_MAP_MAX_POSITION_LENGTH = 100;

export function isNormalizedPoint(value: unknown): value is NormalizedPoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const point = value as Record<string, unknown>;
  return (
    Object.keys(point).every((key) => key === "x" || key === "y") &&
    Object.hasOwn(point, "x") &&
    Object.hasOwn(point, "y") &&
    typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    point.x >= 0 &&
    point.x <= 1 &&
    typeof point.y === "number" &&
    Number.isFinite(point.y) &&
    point.y >= 0 &&
    point.y <= 1
  );
}

export function isValidHeatMapRadii(fullCreditRadius: unknown, toleranceRadius: unknown): boolean {
  return (
    typeof fullCreditRadius === "number" &&
    Number.isFinite(fullCreditRadius) &&
    fullCreditRadius >= 0 &&
    typeof toleranceRadius === "number" &&
    Number.isFinite(toleranceRadius) &&
    toleranceRadius > fullCreditRadius
  );
}
