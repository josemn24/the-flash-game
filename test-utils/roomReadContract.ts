import { describe, expect, it } from "vitest";

export function assertPublicRoomReadModels(values: readonly unknown[]) {
  const serialized = JSON.stringify(values);

  expect(serialized).not.toContain("authUserId");
  expect(serialized).not.toContain("accessToken");
  expect(serialized).not.toContain("refreshToken");
  expect(serialized).not.toContain("platformRoleAssignments");
  expect(serialized).not.toContain("privatePayload");
  expect(serialized).not.toContain("solutionPayload");
}

/**
 * Shared contract harness used by the canonical mock fixtures and Supabase RPC
 * doubles. Adapter-specific mapping and RPC validation remain next to each adapter.
 */
export function defineRoomReadPublicContract(
  name: string,
  readModels: () => Promise<readonly unknown[]>,
) {
  describe(name, () => {
    it("does not expose authentication, tokens or private challenge payloads", async () => {
      assertPublicRoomReadModels(await readModels());
    });
  });
}
