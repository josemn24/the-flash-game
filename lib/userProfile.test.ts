import { describe, expect, it } from "vitest";
import {
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_NAME_MAX_LENGTH,
  getProfileInitials,
  validateProfileImage,
  validateProfileName,
} from "@/lib/userProfile";

describe("user profile helpers", () => {
  it("generates initials from the first two name parts", () => {
    expect(getProfileInitials("  Ana María López ")).toBe("AM");
    expect(getProfileInitials("kike")).toBe("K");
    expect(getProfileInitials("   ")).toBe("");
  });

  it("validates the display name boundaries", () => {
    expect(validateProfileName(" ")).toContain("al menos");
    expect(validateProfileName("A")).toContain("al menos");
    expect(validateProfileName("Kike")).toBeNull();
    expect(validateProfileName("a".repeat(PROFILE_NAME_MAX_LENGTH + 1))).toContain("superar");
  });

  it("rejects non-image files and files over the size limit", () => {
    expect(validateProfileImage({ type: "text/plain", size: 10 })).toBe("type");
    expect(validateProfileImage({ type: "image/png", size: PROFILE_IMAGE_MAX_BYTES + 1 })).toBe(
      "size",
    );
    expect(validateProfileImage({ type: "image/jpeg", size: PROFILE_IMAGE_MAX_BYTES })).toBeNull();
  });
});
