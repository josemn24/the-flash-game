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

function spainAssets() {
  return {
    canaryMap: {
      assetId: "10000000-0000-4000-8000-000000000001",
      objectPath: "question-assets/canary.png",
      metadata: {
        byteSize: 200,
        width: 1475,
        height: 655,
        sha256: "b".repeat(64),
        mimeType: "image/png",
      },
    },
    sagrada: {
      assetId: "10000000-0000-4000-8000-000000000002",
      objectPath: "question-assets/sagrada.jpg",
      metadata: {
        byteSize: 300,
        width: 1920,
        height: 1271,
        sha256: "c".repeat(64),
        mimeType: "image/jpeg",
      },
    },
    meninas: {
      assetId: "10000000-0000-4000-8000-000000000003",
      objectPath: "question-assets/meninas.jpg",
      metadata: {
        byteSize: 400,
        width: 954,
        height: 951,
        sha256: "d".repeat(64),
        mimeType: "image/jpeg",
      },
    },
  };
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

  it("generates three sequential publications in the requested order without history", () => {
    const sql = buildTabarniaDomainSql({
      accounts: accounts(),
      sbrAssetMetadata: {
        byteSize: 10,
        width: 1859,
        height: 968,
        sha256: "a".repeat(64),
        mimeType: "image/png",
      },
      spainAssets: spainAssets(),
      avatarMetadata: avatarMetadata(),
    });

    expect(sql).toContain("'tabarnia'");
    expect(sql).toContain("'open', now(), now() + interval '24 hours'");
    expect(sql).toContain("'scheduled', now() + interval '24 hours', now() + interval '48 hours'");
    expect(sql).toContain("'scheduled', now() + interval '48 hours', now() + interval '72 hours'");
    expect(sql).toContain("'superadmin'");
    expect(sql.match(/'owner'/g)).toHaveLength(1);
    expect(sql.match(/'member'/g)).toHaveLength(11);
    expect(sql).toContain("'Supervivencia: España'");
    expect(sql).toContain("'La Pirámide: Biblia y religiones abrahámicas'");
    expect(sql).toContain("'Steel Ball Run'");
    expect(sql).toContain("'survival'");
    expect(sql).toContain("'pyramid'");
    expect(sql).toContain('"lives":3');
    expect(sql).toContain('"levelId":"entrance"');
    expect(sql).toContain('"dictionaryId":"es-general-5.v1"');
    expect(sql).toContain("'avatars'");
    expect(sql).toContain("'avatar'");
    expect(sql).toContain("'question-assets'");
    expect(sql).toContain("spain-survival-oak-tree");
    expect(sql).toContain("abrahamic-word-hashtag-references");
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
    const loadDictionary = vi.fn();
    const cleanupSpainAssets = vi.fn();
    const output = await setupTabarniaDataset({
      dependencies: {
        localSupabaseConfig: vi.fn(async () => ({
          url: "http://127.0.0.1:54321",
          dbContainer: "supabase_db_test",
        })),
        resetLocalDatabase: reset,
        loadMiniWordleDictionary: loadDictionary,
        createFixedAuthAccounts: vi.fn(async () => accounts()),
        getMapMetadata: vi.fn(async () => ({
          byteSize: 10,
          width: 1859,
          height: 968,
          sha256: "a".repeat(64),
        })),
        getAvatarMetadata: vi.fn(async (user) => avatarMetadata()[user.label]),
        prepareSpainAssets: vi.fn(async () => ({
          assets: spainAssets(),
          cleanup: cleanupSpainAssets,
        })),
        uploadStorageObject,
        dockerSql: runSql,
        writeFixture: saveFixture,
      },
    });

    expect(reset).toHaveBeenCalledOnce();
    expect(loadDictionary).toHaveBeenCalledOnce();
    expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
      loadDictionary.mock.invocationCallOrder[0],
    );
    expect(uploadStorageObject).toHaveBeenCalledTimes(11);
    expect(uploadStorageObject.mock.calls.every(([, input]) => input.upsert)).toBe(true);
    expect(runSql).toHaveBeenCalledOnce();
    expect(saveFixture).toHaveBeenCalledWith(
      "tabarnia",
      expect.objectContaining({ scenario: "tabarnia", version: 1 }),
    );
    expect(
      output.publications.map((publication) => [
        publication.mode,
        publication.questionCount,
        publication.pointsTotal,
      ]),
    ).toEqual([
      ["survival", 20, 100],
      ["pyramid", 7, 100],
      ["flash", 16, 100],
    ]);
    expect(output.publications.map((publication) => publication.status)).toEqual([
      "open",
      "scheduled",
      "scheduled",
    ]);
    expect(output.avatars).toHaveLength(7);
    expect(output.questionAssets).toHaveLength(3);
    expect(cleanupSpainAssets).toHaveBeenCalledOnce();
  });

  it("does not write the manifest and removes Storage when SQL fails", async () => {
    const removeStorageObject = vi.fn();
    const saveFixture = vi.fn();
    const cleanupSpainAssets = vi.fn();
    await expect(
      setupTabarniaDataset({
        dependencies: {
          localSupabaseConfig: async () => ({
            url: "http://localhost:54321",
            dbContainer: "supabase_db_test",
          }),
          resetLocalDatabase: vi.fn(),
          loadMiniWordleDictionary: vi.fn(),
          createFixedAuthAccounts: async () => accounts(),
          getMapMetadata: async () => ({
            byteSize: 10,
            width: 1859,
            height: 968,
            sha256: "a".repeat(64),
          }),
          getAvatarMetadata: async (user) => avatarMetadata()[user.label],
          prepareSpainAssets: async () => ({ assets: spainAssets(), cleanup: cleanupSpainAssets }),
          uploadStorageObject: vi.fn(),
          removeStorageObject,
          dockerSql: async () => {
            throw new Error("Tabarnia SQL failed");
          },
          writeFixture: saveFixture,
        },
      }),
    ).rejects.toThrow("Tabarnia SQL failed");
    expect(removeStorageObject).toHaveBeenCalledTimes(11);
    expect(cleanupSpainAssets).toHaveBeenCalledOnce();
    expect(saveFixture).not.toHaveBeenCalled();
  });
});
