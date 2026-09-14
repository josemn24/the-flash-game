import { describe, expect, it } from "vitest";
import {
  assertSupportedConfigSchemaVersion,
  assertSupportedQuestionPayloadSchemaVersion,
  isSupportedConfigSchemaVersion,
  isSupportedQuestionPayloadSchemaVersion,
  UnsupportedContentContractVersionError,
} from "@/types/contracts";

describe("content contract schema versions", () => {
  it("accepts the current version for both contract families", () => {
    expect(isSupportedQuestionPayloadSchemaVersion(1)).toBe(true);
    expect(isSupportedConfigSchemaVersion(1)).toBe(true);
    expect(() => assertSupportedQuestionPayloadSchemaVersion(1)).not.toThrow();
    expect(() => assertSupportedConfigSchemaVersion(1)).not.toThrow();
  });

  it("rejects unknown and non-positive versions explicitly", () => {
    expect(isSupportedQuestionPayloadSchemaVersion(2)).toBe(false);
    expect(isSupportedConfigSchemaVersion(0)).toBe(false);
    expect(() => assertSupportedQuestionPayloadSchemaVersion(2)).toThrow(
      UnsupportedContentContractVersionError,
    );
    expect(() => assertSupportedConfigSchemaVersion(0)).toThrow(
      UnsupportedContentContractVersionError,
    );
  });
});
