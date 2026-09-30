import { describe, expect, it } from "vitest";
import { E2E_BY_SCENARIO, E2E_SCENARIO_BY_SPEC, normalizeSpecPath } from "./e2e-scenarios.mjs";
import { groupSpecsByScenario, splitPlaywrightArgs } from "./run-e2e.mjs";

describe("E2E scenario bootstrap map", () => {
  it("keeps every pilot scenario mapped to its browser spec", () => {
    for (const [scenario, specs] of Object.entries(E2E_BY_SCENARIO)) {
      for (const spec of specs) expect(E2E_SCENARIO_BY_SPEC.get(spec)).toBe(scenario);
    }
  });

  it("normalizes specs produced by Windows shells", () => {
    expect(normalizeSpecPath(".\\e2e\\s03-flash.spec.ts")).toBe("e2e/s03-flash.spec.ts");
  });

  it("separates Playwright controls and groups specs by isolated fixture", () => {
    const args = ["--grep", "happy path", "e2e/s03-flash.spec.ts", "e2e/s04-recovery.spec.ts"];
    expect(splitPlaywrightArgs(args)).toEqual({
      controlArgs: ["--grep", "happy path"],
      specArgs: ["e2e/s03-flash.spec.ts", "e2e/s04-recovery.spec.ts"],
    });
    expect(groupSpecsByScenario(args.slice(2))).toEqual({
      groups: new Map([
        ["s03", ["e2e/s03-flash.spec.ts"]],
        ["s04", ["e2e/s04-recovery.spec.ts"]],
      ]),
      unprepared: [],
    });
  });
});
