import { afterEach, describe, expect, it } from "vitest";
import { getRuntimeScope, isPilotRuntime, mocksEnabled } from "@/server/runtime-scope";

const originalScope = process.env.FLASH_RUNTIME_SCOPE;
const originalNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

afterEach(() => {
  if (originalScope === undefined) delete process.env.FLASH_RUNTIME_SCOPE;
  else process.env.FLASH_RUNTIME_SCOPE = originalScope;
  setNodeEnv(originalNodeEnv);
});

describe("runtime scope", () => {
  it("uses pilot as the production fail-closed default", () => {
    delete process.env.FLASH_RUNTIME_SCOPE;
    setNodeEnv("production");

    expect(getRuntimeScope()).toBe("pilot");
    expect(isPilotRuntime()).toBe(true);
    expect(mocksEnabled()).toBe(false);
  });

  it("allows explicit demo mocks only outside pilot", () => {
    process.env.FLASH_RUNTIME_SCOPE = "development";

    expect(getRuntimeScope()).toBe("development");
    expect(mocksEnabled()).toBe(true);
  });

  it("rejects an unknown scope instead of silently falling back", () => {
    process.env.FLASH_RUNTIME_SCOPE = "production-with-mocks";

    expect(() => getRuntimeScope()).toThrow("FLASH_RUNTIME_SCOPE");
  });
});
