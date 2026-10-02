import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { QUESTION_INPUT_RENDERERS } from "./QuestionInput";
import { QUESTION_FORMAT_CATALOG } from "./catalog";
import {
  COMPETITIVE_SQL_EXTENSION_TYPES,
  QUESTION_FORMAT_CAPABILITIES,
  QUESTION_FORMAT_TYPES,
  competitiveQuestionTypesFor,
} from "./capabilities";
import {
  COMPETITIVE_ADAPTERS,
  FORMAT_PUBLIC_VALIDATORS,
  FORMAT_SOLUTION_VALIDATORS,
} from "./formatRegistries";
import { SCORING_POLICIES } from "./scoringPolicies";
import { SCORING } from "@/lib/scoringCore/registry";

const sql = (file: string) =>
  readFileSync(join(process.cwd(), "supabase", "schemas", file), "utf8");

function sqlExtensionTypes(source: string): string[] {
  const match = source.match(/expected_type not in \(([\s\S]*?)\)/);
  if (!match) throw new Error("No se encontró la allowlist SQL de extensiones competitivas.");
  return (match[1].match(/'[^']+'/g) ?? []).map((entry) => entry.slice(1, -1));
}

function sqlFlashTypes(source: string): string[] {
  const match = source.match(/question->>'type' not in \(([\s\S]*?)\)/);
  if (!match) throw new Error("No se encontró la allowlist SQL de formatos Flash.");
  return (match[1].match(/'[^']+'/g) ?? []).map((entry) => entry.slice(1, -1));
}

describe("format capability manifest", () => {
  it("contains the complete 31-format product vocabulary", () => {
    expect(QUESTION_FORMAT_TYPES).toHaveLength(31);
    expect(new Set(QUESTION_FORMAT_TYPES).size).toBe(31);
    expect(Object.keys(QUESTION_FORMAT_CAPABILITIES).sort()).toEqual(
      [...QUESTION_FORMAT_TYPES].sort(),
    );
  });

  it("keeps practice catalog, renderers, validators and scoring aligned", () => {
    for (const type of QUESTION_FORMAT_TYPES) {
      const capability = QUESTION_FORMAT_CAPABILITIES[type];
      expect(capability.id).toBe(type);
      expect(capability.practice.supported).toBe(true);
      expect(capability.practice.catalogVisible).toBe(true);
      expect(capability.practice.exampleRequired).toBe(true);
      expect(QUESTION_FORMAT_CATALOG[type].examples.length).toBeGreaterThan(0);
      expect(
        QUESTION_INPUT_RENDERERS[
          capability.practice.rendererKey as keyof typeof QUESTION_INPUT_RENDERERS
        ],
      ).toBeTypeOf("function");
      expect(
        FORMAT_PUBLIC_VALIDATORS[
          capability.validation.publicValidatorKey as keyof typeof FORMAT_PUBLIC_VALIDATORS
        ],
      ).toBe(true);
      expect(
        FORMAT_SOLUTION_VALIDATORS[
          capability.validation.solutionValidatorKey as keyof typeof FORMAT_SOLUTION_VALIDATORS
        ],
      ).toBe(true);
      expect(SCORING[type].policy).toBe(capability.scoringPolicyId);
      expect(SCORING_POLICIES[type].id).toBe(capability.scoringPolicyId);
      for (const competitive of Object.values(capability.competitive)) {
        if (!competitive) continue;
        expect(
          COMPETITIVE_ADAPTERS[competitive.adapterKey as keyof typeof COMPETITIVE_ADAPTERS],
        ).toBe(true);
        expect(competitive.payloadSchemaVersions.length).toBeGreaterThan(0);
      }
    }
  });

  it("declares the existing mode boundaries", () => {
    expect(competitiveQuestionTypesFor("alphabet")).toEqual(["short-text"]);
    expect(competitiveQuestionTypesFor("survival")).not.toContain("short-text");
    expect(competitiveQuestionTypesFor("narrative")).not.toContain("short-text");
    expect(competitiveQuestionTypesFor("narrative")).toContain("mini-wordle");
    expect(QUESTION_FORMAT_CAPABILITIES["mini-wordle"].competitive.flash?.transport).toBe(
      "specialized",
    );
  });

  it("matches the SQL competitive-extension allowlist", () => {
    const sqlTypes = sqlExtensionTypes(sql("68_competitive_question_formats.sql")).sort();
    expect(sqlTypes).toEqual([...COMPETITIVE_SQL_EXTENSION_TYPES].sort());
    expect(sqlFlashTypes(sql("54_question_validation.sql")).sort()).toEqual(
      [...competitiveQuestionTypesFor("flash")].sort(),
    );
    expect(sql("54_question_validation.sql")).toContain(
      "private.is_supported_competitive_question_extension",
    );
    expect(sql("59_superadmin_calendar_commands.sql")).toContain(
      "private.is_supported_flash_question",
    );
  });
});
