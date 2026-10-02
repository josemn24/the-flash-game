import {
  COMPETITIVE_FORMAT_TYPES,
  competitiveCapabilityFor,
} from "@/lib/question-formats/definitions";
import { describe, expect, it } from "vitest";
import { isFlashReadRow, isFlashResultRow } from "./flashQueries";

const row = {
  room_id: "room",
  room_slug: "room",
  room_title: "Room",
  publication_id: "publication",
  publication_status: "open",
  challenge_id: "challenge",
  challenge_version_id: "version",
  challenge_title: "Title",
  challenge_subtitle: "",
  challenge_description: "Description",
  challenge_mode: "flash",
  challenge_max_score: 100,
  question_count: 2,
  own_attempt_id: null,
  own_attempt_status: null,
  own_attempt_score: null,
  own_attempt_lock_version: null,
  challenge_item_id: "item",
  item_position: 1,
  question_version_id: "question",
  question_type: "multiple-choice",
  payload_schema_version: 1,
  time_limit_ms: 15000,
  item_points: 50,
};
describe("format admission in competitive read projections", () => {
  it("accepts every declared Flash, Survival and Pyramid version and rejects undeclared combinations", () => {
    for (const mode of ["flash", "survival", "pyramid"] as const)
      for (const type of COMPETITIVE_FORMAT_TYPES) {
        const capability = competitiveCapabilityFor(type, mode);
        for (const version of [1, 2, 999])
          expect(
            isFlashReadRow({
              ...row,
              challenge_mode: mode,
              question_count: mode === "pyramid" ? 7 : 2,
              question_type: type,
              payload_schema_version: version,
            }),
          ).toBe(capability?.payloadSchemaVersions.includes(version) ?? false);
      }
    expect(isFlashReadRow({ ...row, question_type: "unknown" })).toBe(false);
    expect(isFlashReadRow({ ...row, payload_schema_version: "1" })).toBe(false);
  });
  it("keeps short-text and image multiple-choice readable in terminal projections", () => {
    for (const [type, version] of [
      ["short-text", 1],
      ["multiple-choice", 2],
    ] as const) {
      expect(
        isFlashResultRow({
          attempt_id: "attempt",
          scheduled_challenge_id: "publication",
          challenge_item_id: "item",
          item_position: 1,
          question_type: type,
          payload_schema_version: version,
          public_payload: {},
          solution_payload: {},
          answer: null,
          answer_status: "correct",
          points: 50,
          time_used_ms: 1000,
          attempt_status: "completed",
          attempt_score: 50,
        }),
      ).toBe(true);
    }
  });
});
