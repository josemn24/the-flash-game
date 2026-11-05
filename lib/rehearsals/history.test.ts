import { expect, it } from "vitest";
import { appendRehearsalHistory } from "@/scripts/register-rehearsal-history.mjs";
import { rehearsalHash } from "./hash";

it("registers new versions with the canonical hash and preserves existing references", () => {
  const q = {
    id: "prueba",
    version: 1,
    solutionPayload: { correctAnswer: "a\u0301" },
    publicPayload: { question: "Árbol" },
  };
  const previous = [{ id: q.id, version: q.version, contentHash: rehearsalHash(q) }];
  const next = { ...q, version: 2 };
  const registered = appendRehearsalHistory([next, q], previous);
  expect(registered).toEqual([
    ...previous,
    { id: q.id, version: 2, contentHash: rehearsalHash(next) },
  ]);
  expect(registered[0]).toBe(previous[0]);
  expect(appendRehearsalHistory([q, next], registered)).toEqual(registered);
});
it("refuses to register over a changed or removed historical version", () => {
  const q = { id: "prueba", version: 1, explanation: "original" };
  const previous = appendRehearsalHistory([q], []);
  expect(() => appendRehearsalHistory([], previous)).toThrow(
    "historical_version_missing_or_changed",
  );
  expect(() => appendRehearsalHistory([{ ...q, explanation: "changed" }], previous)).toThrow(
    "historical_version_missing_or_changed",
  );
  expect(() => appendRehearsalHistory([q, q], previous)).toThrow("duplicate_question_version");
});
