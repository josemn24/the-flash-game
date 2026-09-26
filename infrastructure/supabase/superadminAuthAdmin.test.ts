import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperadminAuthAdminError, createOrRecoverSuperadminAuthUser } from "./superadminAuthAdmin";

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/config", () => ({
  getSupabaseServiceRoleKey: () => "server-only-test-key-not-for-production",
  getSupabaseUrl: () => "http://supabase.test",
}));

const input = {
  email: "new@example.com",
  password: "initial-password-123",
  displayName: "New Player",
  idempotencyKey: "create-user-operation-1",
};

describe("superadmin Auth admin integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let createdUser: Record<string, unknown> | null = null;
    mocks.listUsers.mockImplementation(async () => ({
      data: { users: createdUser ? [createdUser] : [] },
      error: null,
    }));
    mocks.createUser.mockImplementation(async (attributes) => {
      createdUser = {
        id: "00000000-0000-4000-8000-000000000001",
        email: attributes.email,
        app_metadata: attributes.app_metadata,
      };
      return { data: { user: createdUser }, error: null };
    });
    mocks.createClient.mockImplementation(() => ({
      auth: { admin: { listUsers: mocks.listUsers, createUser: mocks.createUser } },
    }));
  });

  it("creates a confirmed account directly without sending an invitation", async () => {
    await expect(createOrRecoverSuperadminAuthUser(input)).resolves.toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { display_name: input.displayName },
        app_metadata: expect.objectContaining({ superadmin_user_creation: expect.any(Object) }),
      }),
    );
    expect(mocks.createUser.mock.calls[0][0]).not.toHaveProperty("email_redirect_to");
  });

  it("recovers a retry with the same metadata marker without creating a duplicate", async () => {
    const userId = await createOrRecoverSuperadminAuthUser(input);
    await expect(createOrRecoverSuperadminAuthUser(input)).resolves.toBe(userId);
    expect(mocks.createUser).toHaveBeenCalledTimes(1);
  });

  it("rejects reuse of an idempotency key with changed input", async () => {
    await createOrRecoverSuperadminAuthUser(input);

    await expect(
      createOrRecoverSuperadminAuthUser({
        ...input,
        password: "a-different-password-456",
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    expect(mocks.createUser).toHaveBeenCalledTimes(1);
  });

  it("does not adopt an unrelated existing email", async () => {
    mocks.listUsers.mockResolvedValue({
      data: { users: [{ id: "existing", email: input.email, app_metadata: {} }] },
      error: null,
    });

    await expect(createOrRecoverSuperadminAuthUser(input)).rejects.toMatchObject({
      name: "SuperadminAuthAdminError",
      code: "email_already_registered",
    } satisfies Partial<SuperadminAuthAdminError>);
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
});
