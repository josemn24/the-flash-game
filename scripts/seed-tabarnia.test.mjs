import { describe, expect, it, vi } from "vitest";
import { buildTabarniaDomainSql, setupTabarniaDataset, TABARNIA_USERS } from "./seed-tabarnia.mjs";
import { TABARNIA_FICTION_ALPHABET } from "./fixtures/scenarios/tabarnia-multiverse.mjs";

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
    expect(TABARNIA_USERS).toHaveLength(16);
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
      "mimi",
      "lucas",
      "neak",
    ]);
    expect(TABARNIA_USERS.find((user) => user.label === "xesmona")).toMatchObject({
      role: "superadmin",
    });
    expect(TABARNIA_USERS.find((user) => user.label === "ches")).toMatchObject({
      displayName: "Ches",
      role: "owner",
    });
    expect(TABARNIA_USERS.filter((user) => user.role === "member")).toHaveLength(14);
  });

  it("defines sixteen affirmative fiction letters with accepted answers", () => {
    const entries = TABARNIA_FICTION_ALPHABET.entries;
    expect(entries.map((entry) => entry.letter)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "I",
      "J",
      "L",
      "M",
      "O",
      "P",
      "R",
      "S",
      "T",
      "Z",
    ]);
    expect(new Set(entries.map((entry) => entry.slug)).size).toBe(16);
    expect(new Set(entries.map((entry) => entry.letter)).size).toBe(16);
    expect(
      entries.every((entry) =>
        entry.correctAnswer.toLocaleUpperCase("es").startsWith(entry.letter),
      ),
    ).toBe(true);
    expect(entries.every((entry) => entry.acceptedAnswers.includes(entry.correctAnswer))).toBe(
      true,
    );
    expect(entries.every((entry) => !/[?？]/u.test(entry.prompt))).toBe(true);
    expect(TABARNIA_FICTION_ALPHABET.globalTimeLimitMs).toBe(150_000);
    expect(TABARNIA_FICTION_ALPHABET.questionTimeLimitMs).toBe(120_000);
  });

  it("generates eight sequential publications in the requested order without history", () => {
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
    expect(sql).toContain("'scheduled', now() + interval '72 hours', now() + interval '96 hours'");
    expect(sql).toContain("'scheduled', now() + interval '96 hours', now() + interval '120 hours'");
    expect(sql).toContain("'scheduled', now() + interval '120 hours', now() + interval '144 hours'");
    expect(sql).toContain("'scheduled', now() + interval '144 hours', now() + interval '168 hours'");
    expect(sql).toContain("'scheduled', now() + interval '168 hours', now() + interval '192 hours'");
    expect(sql).toContain("'superadmin'");
    expect(sql.match(/'owner'/g)).toHaveLength(1);
    expect(sql.match(/'member'/g)).toHaveLength(11);
    expect(sql).toContain("'España'");
    expect(sql).toContain("'Multiverso friki'");
    expect(sql).toContain("'La Pirámide: Cumbre lógica'");
    expect(sql).toContain("'Contrarreloj Queens'");
    expect(sql).toContain("'Contrarreloj Conectar parejas'");
    expect(sql).toContain("'Biblia y religiones abrahámicas'");
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
    expect(sql).toContain("pyramid-square-intruder");
    expect(sql).toContain("pyramid-summit-queens");
    expect(sql).toContain("tabarnia-queens-time-trial-6");
    expect(sql).toContain("tabarnia-connect-pairs-time-trial-6");
    expect(sql).toContain("'time-trial'");
    expect(sql).toContain('"correctAnswer":"square-27"');
    expect(sql).toContain('"correctOptionId":"triangle-up"');
    expect(sql).toContain("avatars/00000003-0000-4000-8000-000000000000/");
    expect(sql.match(/update public\.players set avatar_path/g)).toHaveLength(7);
    expect(sql).not.toContain("insert into public.attempts");
    expect(sql).not.toContain("answer_receipts");
    expect(sql).not.toContain("flash_point_entries");
    expect((sql.match(/insert into private\.question_definitions/g) ?? []).length).toBe(1);
    expect(sql).toContain("'sbr-fire-horse-year'");
    expect(sql).toContain("'sbr-creator'");
    expect(sql).toContain("'alphabet-fiction-a'");
    expect(sql).toContain("'alphabet-fiction-z'");
    expect(sql).toContain("'short-text'");
    expect(sql).toContain('"correctAnswer":"Aladdin"');
    expect(sql).toContain('"letter":"A"');
  });

  it("generates eight contiguous five-minute publications for the fast schedule", () => {
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
      schedule: "fast",
    });

    expect(sql).toContain("'open', now(), now() + interval '5 minutes'");
    expect(sql).toContain(
      "'scheduled', now() + interval '5 minutes', now() + interval '10 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', now() + interval '10 minutes', now() + interval '15 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', now() + interval '15 minutes', now() + interval '20 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', now() + interval '20 minutes', now() + interval '25 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', now() + interval '25 minutes', now() + interval '30 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', now() + interval '30 minutes', now() + interval '35 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', now() + interval '35 minutes', now() + interval '40 minutes'",
    );
    expect(sql).toContain("'active', now(), now() + interval '40 minutes'");
  });

  it("includes the selected schedule in the Tabarnia manifest", async () => {
    const output = await setupTabarniaDataset({
      schedule: "fast",
      dependencies: {
        localSupabaseConfig: vi.fn(async () => ({
          url: "http://127.0.0.1:54321",
          dbContainer: "supabase_db_test",
        })),
        resetLocalDatabase: vi.fn(),
        removeFixture: vi.fn(),
        loadMiniWordleDictionary: vi.fn(),
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
          cleanup: vi.fn(),
        })),
        uploadStorageObject: vi.fn(),
        dockerSql: vi.fn(),
        writeFixture: vi.fn(),
      },
    });

    expect(output).toMatchObject({
      scheduleProfile: "fast",
      scheduleWindowMinutes: 5,
      seasonDurationMinutes: 40,
    });
    expect(
      output.publications.map((publication) => [
        publication.opensAfterMinutes,
        publication.durationMinutes,
      ]),
    ).toEqual([
      [0, 5],
      [5, 5],
      [10, 5],
      [15, 5],
      [20, 5],
      [25, 5],
      [30, 5],
      [35, 5],
    ]);
  });

  it("rejects an unknown schedule profile before building SQL", () => {
    expect(() =>
      buildTabarniaDomainSql({
        accounts: accounts(),
        sbrAssetMetadata: {},
        schedule: "hourly",
      }),
    ).toThrow("Perfil de calendario no válido");
  });

  it("resets, uploads the asset, executes SQL and writes the manifest", async () => {
    const runSql = vi.fn();
    const saveFixture = vi.fn();
    const uploadStorageObject = vi.fn();
    const reset = vi.fn();
    const removeFixture = vi.fn();
    const loadDictionary = vi.fn();
    const cleanupSpainAssets = vi.fn();
    const output = await setupTabarniaDataset({
      dependencies: {
        localSupabaseConfig: vi.fn(async () => ({
          url: "http://127.0.0.1:54321",
          dbContainer: "supabase_db_test",
        })),
        resetLocalDatabase: reset,
        removeFixture,
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
    expect(removeFixture).toHaveBeenCalledWith("betavip");
    expect(removeFixture.mock.invocationCallOrder[0]).toBeLessThan(
      reset.mock.invocationCallOrder[0],
    );
    expect(loadDictionary).toHaveBeenCalledOnce();
    expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
      loadDictionary.mock.invocationCallOrder[0],
    );
    expect(uploadStorageObject).toHaveBeenCalledTimes(11);
    expect(uploadStorageObject.mock.calls.every(([, input]) => input.upsert === false)).toBe(true);
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
      ["flash", 16, 100],
      ["alphabet", 16, 100],
      ["time-trial", 6, 100],
      ["survival", 20, 100],
      ["pyramid", 7, 100],
      ["alphabet", 16, 100],
      ["time-trial", 6, 100],
      ["pyramid", 7, 100],
    ]);
    expect(output.publicationId).toBe(output.publications[0]?.id);
    expect(output.publications.map((publication) => publication.title)).toEqual([
      "Steel Ball Run",
      "Reino de animales",
      "Contrarreloj Queens",
      "España",
      "La Pirámide: Cumbre lógica",
      "Multiverso friki",
      "Contrarreloj Conectar parejas",
      "Biblia y religiones abrahámicas",
    ]);
    expect(output.publications.map((publication) => publication.status)).toEqual([
      "open",
      "scheduled",
      "scheduled",
      "scheduled",
      "scheduled",
      "scheduled",
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
          removeFixture: vi.fn(),
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
