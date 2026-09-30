export const E2E_BY_SCENARIO = Object.freeze({
  portal: ["e2e/admin-portal.spec.ts"],
  s02: ["e2e/s02-rooms.spec.ts"],
  s03: ["e2e/s03-flash.spec.ts"],
  e01: ["e2e/e01-mini-wordle.spec.ts"],
  e02: ["e2e/e02-logic-code.spec.ts"],
  e03: ["e2e/e03-progressive-clues.spec.ts"],
  e04: ["e2e/e04-matching.spec.ts"],
  e05: ["e2e/e05-queens.spec.ts"],
  e06: ["e2e/e06-word-search.spec.ts"],
  e10: ["e2e/e10-progressive-image.spec.ts"],
  f08: ["e2e/f08-logic-matrix.spec.ts"],
  f16: ["e2e/f16-zip.spec.ts"],
  f18: ["e2e/f18-escape.spec.ts"],
  f19: ["e2e/f19-word-hashtag.spec.ts"],
  s04: ["e2e/s04-recovery.spec.ts"],
  s06: ["e2e/s06-ranking.spec.ts"],
  s07: ["e2e/s07-history-review.spec.ts"],
  s08: ["e2e/admin-room-creation.spec.ts"],
  s10: ["e2e/s10-season.spec.ts"],
  s11: ["e2e/s11-editorial.spec.ts"],
  s12: ["e2e/s12-calendar.spec.ts"],
  s14: ["e2e/s14-survival.spec.ts"],
  s15: ["e2e/s15-pyramid.spec.ts"],
  s17: ["e2e/s17-editorial-versioning.spec.ts"],
  sbr: ["e2e/sbr-persisted.spec.ts"],
});

export const E2E_SCENARIO_BY_SPEC = new Map(
  Object.entries(E2E_BY_SCENARIO).flatMap(([scenario, specs]) =>
    specs.map((spec) => [spec, scenario]),
  ),
);

export const PILOT_E2E_BY_SCENARIO = Object.freeze({
  portal: E2E_BY_SCENARIO.portal,
  s02: E2E_BY_SCENARIO.s02,
  s03: E2E_BY_SCENARIO.s03,
  e01: E2E_BY_SCENARIO.e01,
  e02: E2E_BY_SCENARIO.e02,
  e03: E2E_BY_SCENARIO.e03,
  e04: E2E_BY_SCENARIO.e04,
  e05: E2E_BY_SCENARIO.e05,
  e06: E2E_BY_SCENARIO.e06,
  f08: E2E_BY_SCENARIO.f08,
  f16: E2E_BY_SCENARIO.f16,
  f18: E2E_BY_SCENARIO.f18,
  f19: E2E_BY_SCENARIO.f19,
  s04: E2E_BY_SCENARIO.s04,
  s06: E2E_BY_SCENARIO.s06,
  s07: E2E_BY_SCENARIO.s07,
  s10: E2E_BY_SCENARIO.s10,
  s11: E2E_BY_SCENARIO.s11,
  s12: E2E_BY_SCENARIO.s12,
  s17: E2E_BY_SCENARIO.s17,
});

export const BROWSER_FIXTURE_SPECS = Object.freeze(["e2e/flash-layout.spec.ts"]);

export function normalizeSpecPath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function scenarioForSpec(value) {
  return E2E_SCENARIO_BY_SPEC.get(normalizeSpecPath(value)) ?? null;
}
