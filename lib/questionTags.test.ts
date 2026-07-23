import { describe, expect, it } from "vitest";

import { connectionsStage } from "@/data/connectionsStage";
import { demoStage } from "@/data/demoStage";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
import {
  getQuestionDomainIds,
  getTopicDomainIds,
  type QuestionTags,
  validateQuestionTags,
} from "@/lib/questionTags";

describe("question tags", () => {
  it("accepts valid tags", () => {
    expect(
      validateQuestionTags({
        domains: ["mathematics"],
        topics: ["number_sequences"],
        cognitiveSkills: ["logical_reasoning"],
        formatSkills: ["deduction"],
      }),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects unknown topics", () => {
    const result = validateQuestionTags({
      domains: ["mathematics"],
      topics: ["missing_topic"],
      cognitiveSkills: ["logical_reasoning"],
      formatSkills: ["deduction"],
    } as QuestionTags);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("unknown topic: missing_topic");
  });

  it("rejects topics unrelated to the declared domains", () => {
    const result = validateQuestionTags({
      domains: ["history"],
      topics: ["number_sequences"],
      cognitiveSkills: ["logical_reasoning"],
      formatSkills: ["deduction"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("topic number_sequences is not related to any declared domain");
  });

  it("resolves domains from multidomain topics", () => {
    expect(getTopicDomainIds("personal_finance")).toEqual(["economics", "mathematics"]);
    expect(
      getQuestionDomainIds({
        tags: {
          domains: ["economics"],
          topics: ["personal_finance"],
          cognitiveSkills: ["decision_making"],
          formatSkills: ["comparison"],
          lifeSkills: ["personal_finance"],
        },
      }),
    ).toEqual(["economics", "mathematics"]);
  });

  it("keeps playable stages and format examples valid", () => {
    const stageQuestions = [...demoStage.questions, ...connectionsStage.questions];
    const catalogQuestions = Object.values(QUESTION_FORMAT_CATALOG).flatMap((format) =>
      format.examples.map((example) => example.question),
    );

    for (const question of [...stageQuestions, ...catalogQuestions]) {
      expect(validateQuestionTags(question.tags), question.id).toEqual({ valid: true, errors: [] });
    }
  });
});
