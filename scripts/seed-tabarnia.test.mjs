import { describe, expect, it, vi } from "vitest";
import { buildTabarniaDomainSql, setupTabarniaDataset, TABARNIA_USERS } from "./seed-tabarnia.mjs";

function accounts() {
  return Object.fromEntries(
    TABARNIA_USERS.map((user, index) => [
      user.label,
      {
        email: user.email,
        password: user.password,
        playerId: `0000000${index + 1}-0000-4000-8000-000000000000`,
      },
    ]),
  );
}

function avatarMetadata() {
  return Object.fromEntries(
    TABARNIA_USERS.filter((user) => user.avatarFile).map((user) => [
      user.label,
      {
        byteSize: 640,
        width: 640,
        height: 640,
        sha256: "a".repeat(64),
        mimeType: "image/jpeg",
        extension: user.avatarFile.split(".").pop(),
        filePath: `/tmp/${user.avatarFile}`,
      },
    ]),
  );
}

describe("Tabarnia seed", () => {
  it("defines the fixed cohort and the requested roles", () => {
    expect(TABARNIA_USERS).toHaveLength(13);
    expect(TABARNIA_USERS.filter((user) => user.avatarFile).map((user) => user.avatarFile)).toEqual(
      [
        "dark.jpeg",
        "palmera.jpeg",
        "kike.jpeg",
        "rielbe.jpeg",
        "jacobo.jpeg",
        "lambda.jpg",
        "jhon3d.jpg",
      ],
    );
    expect(TABARNIA_USERS.filter((user) => !user.avatarFile).map((user) => user.label)).toEqual([
      "xesmona",
      "ches",
      "carlos",
      "javi",
      "alejandro",
      "diego",
    ]);
    expect(TABARNIA_USERS.find((user) => user.label === "xesmona")).toMatchObject({
      role: "superadmin",
    });
    expect(TABARNIA_USERS.find((user) => user.label === "ches")).toMatchObject({
      displayName: "Ches",
      role: "owner",
    });
    expect(TABARNIA_USERS.filter((user) => user.role === "member")).toHaveLength(11);
  });

  it("generates one open 16-question SBR publication without history", () => {
    const sql = buildTabarniaDomainSql({
      accounts: accounts(),
      assetMetadata: { byteSize: 10, width: 1859, height: 968, sha256: "a".repeat(64) },
      avatarMetadata: avatarMetadata(),
    });

    expect(sql).toContain("'tabarnia'");
    expect(sql).toContain("'open', now(), now() + interval '24 hours'");
    expect(sql).toContain("'superadmin'");
    expect(sql.match(/'owner'/g)).toHaveLength(1);
    expect(sql.match(/'member'/g)).toHaveLength(11);
    expect(sql).toContain("'Steel Ball Run'");
    expect(sql).toContain("'avatars'");
    expect(sql).toContain("'avatar'");
    expect(sql).toContain("avatars/00000003-0000-4000-8000-000000000000/");
    expect(sql.match(/update public\.players set avatar_path/g)).toHaveLength(7);
    expect(sql).not.toContain("insert into public.attempts");
    expect(sql).not.toContain("answer_receipts");
    expect(sql).not.toContain("flash_point_entries");
    expect((sql.match(/insert into private\.question_definitions/g) ?? []).length).toBe(1);
    expect(sql).toContain("'sbr-fire-horse-year'");
    expect(sql).toContain("'sbr-creator'");
  });

  it("resets, uploads the asset, executes SQL and writes the manifest", async () => {
    const runSql = vi.fn();
    const saveFixture = vi.fn();
    const uploadStorageObject = vi.fn();
    const reset = vi.fn();
    const output = await setupTabarniaDataset({
      dependencies: {
        localSupabaseConfig: vi.fn(async () => ({
          url: "http://127.0.0.1:54321",
          dbContainer: "supabase_db_test",
        })),
        resetLocalDatabase: reset,
        createFixedAuthAccounts: vi.fn(async () => accounts()),
        getMapMetadata: vi.fn(async () => ({
          byteSize: 10,
          width: 1859,
          height: 968,
          sha256: "a".repeat(64),
        })),
        getAvatarMetadata: vi.fn(async (user) => avatarMetadata()[user.label]),
        uploadStorageObject,
        dockerSql: runSql,
        writeFixture: saveFixture,
      },
    });

    expect(reset).toHaveBeenCalledOnce();
    expect(uploadStorageObject).toHaveBeenCalledTimes(8);
    expect(uploadStorageObject.mock.calls.every(([, input]) => input.upsert)).toBe(true);
    expect(runSql).toHaveBeenCalledOnce();
    expect(saveFixture).toHaveBeenCalledWith(
      "tabarnia",
      expect.objectContaining({ scenario: "tabarnia", version: 1 }),
    );
    expect(output.questionCount).toBe(16);
    expect(output.pointsTotal).toBe(100);
    expect(output.avatars).toHaveLength(7);
  });

  it("does not write the manifest and removes Storage when SQL fails", async () => {
    const removeStorageObject = vi.fn();
    const saveFixture = vi.fn();
    await expect(
      setupTabarniaDataset({
        dependencies: {
          localSupabaseConfig: async () => ({
            url: "http://localhost:54321",
            dbContainer: "supabase_db_test",
          }),
          resetLocalDatabase: vi.fn(),
          createFixedAuthAccounts: async () => accounts(),
          getMapMetadata: async () => ({
            byteSize: 10,
            width: 1859,
            height: 968,
            sha256: "a".repeat(64),
          }),
          getAvatarMetadata: async (user) => avatarMetadata()[user.label],
          uploadStorageObject: vi.fn(),
          removeStorageObject,
          dockerSql: async () => {
            throw new Error("Tabarnia SQL failed");
          },
          writeFixture: saveFixture,
        },
      }),
    ).rejects.toThrow("Tabarnia SQL failed");
    expect(removeStorageObject).toHaveBeenCalledTimes(8);
    expect(saveFixture).not.toHaveBeenCalled();
  });
});
