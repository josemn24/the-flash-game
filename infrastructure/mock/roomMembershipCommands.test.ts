import { afterEach, describe, expect, it } from "vitest";
import { DEMO_REFERENCE_TIME, demoIdentity, playerRouteAliases } from "@/data/mock/constants";
import { mockDomainStore } from "@/data/mock/store";
import { MockCurrentViewerProvider } from "./currentViewer";
import { MockRoomMembershipCommands, resetMockMembershipOverrides } from "./roomMembershipCommands";
import { MockRoomQueries } from "./roomQueries";

afterEach(() => resetMockMembershipOverrides());

describe("MockRoomMembershipCommands", () => {
  it("promotes and demotes members for the owner and keeps the read model in sync", async () => {
    const commands = new MockRoomMembershipCommands(
      mockDomainStore,
      new MockCurrentViewerProvider(mockDomainStore, demoIdentity.currentPlayerId),
    );

    await expect(
      commands.manageMember({
        idempotencyKey: "mock-promote-1",
        roomKey: "tabarnia-room",
        targetMemberKey: "marta",
        action: "grant_admin",
      }),
    ).resolves.toMatchObject({ role: "admin", status: "active" });
    await expect(
      commands.manageMember({
        idempotencyKey: "mock-promote-1",
        roomKey: "tabarnia-room",
        targetMemberKey: "marta",
        action: "grant_admin",
      }),
    ).resolves.toMatchObject({ role: "admin", status: "active" });
    await expect(
      commands.manageMember({
        idempotencyKey: "mock-promote-1",
        roomKey: "tabarnia-room",
        targetMemberKey: "marta",
        action: "revoke_admin",
      }),
    ).rejects.toThrow("idempotency_conflict");

    await expect(
      new MockRoomQueries(mockDomainStore).getSettings("tabarnia-room", {
        viewerId: demoIdentity.currentPlayerId,
        now: DEMO_REFERENCE_TIME,
      }),
    ).resolves.toMatchObject({
      members: expect.arrayContaining([expect.objectContaining({ id: "marta", role: "admin" })]),
    });

    await expect(
      commands.manageMember({
        idempotencyKey: "mock-demote-1",
        roomKey: "tabarnia-room",
        targetMemberKey: "marta",
        action: "revoke_admin",
      }),
    ).resolves.toMatchObject({ role: "member", status: "active" });
  });

  it("allows the owner to remove a member logically and rejects non-owner actors", async () => {
    const ownerCommands = new MockRoomMembershipCommands(
      mockDomainStore,
      new MockCurrentViewerProvider(mockDomainStore, demoIdentity.currentPlayerId),
    );
    await expect(
      ownerCommands.manageMember({
        idempotencyKey: "mock-remove-1",
        roomKey: "tabarnia-room",
        targetMemberKey: "laura",
        action: "remove",
      }),
    ).resolves.toMatchObject({ role: "member", status: "removed" });

    await expect(
      new MockRoomQueries(mockDomainStore).getSettings("tabarnia-room", {
        viewerId: demoIdentity.currentPlayerId,
        now: DEMO_REFERENCE_TIME,
      }),
    ).resolves.toMatchObject({
      members: expect.not.arrayContaining([expect.objectContaining({ id: "laura" })]),
    });

    const memberCommands = new MockRoomMembershipCommands(
      mockDomainStore,
      new MockCurrentViewerProvider(mockDomainStore, playerRouteAliases.ches),
    );
    await expect(
      memberCommands.manageMember({
        idempotencyKey: "mock-denied-1",
        roomKey: "tabarnia-room",
        targetMemberKey: "marta",
        action: "grant_admin",
      }),
    ).rejects.toThrow("not_authorized");
  });

  it("cannot modify the owner", async () => {
    const commands = new MockRoomMembershipCommands(
      mockDomainStore,
      new MockCurrentViewerProvider(mockDomainStore, demoIdentity.currentPlayerId),
    );
    await expect(
      commands.manageMember({
        idempotencyKey: "mock-owner-1",
        roomKey: "tabarnia-room",
        targetMemberKey: "player",
        action: "remove",
      }),
    ).rejects.toThrow("not_authorized");
  });
});
