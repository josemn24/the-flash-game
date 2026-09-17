import "server-only";

export type RuntimeScope = "pilot" | "development" | "test";

function isRuntimeScope(value: string | undefined): value is RuntimeScope {
  return value === "pilot" || value === "development" || value === "test";
}

/**
 * Production is deliberately fail-closed. Local development and Vitest keep
 * the explicit mock/demo routes available without making them a fallback for
 * the pilot runtime.
 */
export function getRuntimeScope(): RuntimeScope {
  const configured = process.env.FLASH_RUNTIME_SCOPE;
  if (configured) {
    if (!isRuntimeScope(configured)) {
      throw new Error("FLASH_RUNTIME_SCOPE must be pilot, development or test.");
    }
    return configured;
  }

  if (process.env.NODE_ENV === "production") return "pilot";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

export function mocksEnabled(): boolean {
  return getRuntimeScope() !== "pilot";
}

export function isPilotRuntime(): boolean {
  return getRuntimeScope() === "pilot";
}
