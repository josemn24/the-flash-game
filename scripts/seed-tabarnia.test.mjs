import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { parseFlashEditorialQuestionDocument } from "../lib/editorial/flashDocument.ts";
import { supabaseCompetitiveEvaluator } from "../server/evaluation/competitive-evaluator.ts";
import {
  buildTabarniaDomainSql,
  setupTabarniaDataset,
  tabarniaManifest,
  TABARNIA_USERS,
} from "./seed-tabarnia.mjs";
import {
  TABARNIA_FICTION_ALPHABET,
  tabarniaMultiverseQuestions,
} from "./fixtures/scenarios/tabarnia-multiverse.mjs";
import { TABARNIAVERSO_QUESTIONS } from "./fixtures/scenarios/tabarniaverso.mjs";

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
        mimeType: user.avatarFile.endsWith(".webp") ? "image/webp" : "image/jpeg",
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
  it("ships avatar files matching their declared image formats", async () => {
    for (const user of TABARNIA_USERS.filter((user) => user.avatarFile)) {
      const metadata = await sharp(`public/flash-pop/avatars/${user.avatarFile}`).metadata();
      const extension = user.avatarFile.split(".").pop();
      expect(metadata.format, user.avatarFile).toBe(extension === "jpg" ? "jpeg" : extension);
    }
  });
  it.each([
    ["10m", 10, 90],
    ["30m", 30, 270],
    ["1h", 60, 540],
    ["90m", 90, 810],
  ])(
    "generates matching SQL and manifest for %s without changing game clocks",
    (schedule, minutes, total) => {
      const input = {
        accounts: accounts(),
        sbrAssetMetadata: {},
        spainAssets: spainAssets(),
        avatarMetadata: avatarMetadata(),
      };
      const startsAt = "2099-10-20T19:00:20.168+02:00";
      const start = "'2099-10-20T17:00:20.168Z'::timestamptz";
      const data = tabarniaManifest(input.accounts, input.avatarMetadata, schedule, startsAt);
      const sql = buildTabarniaDomainSql({ ...input, schedule, startsAt });
      expect(data).toMatchObject({
        scheduleProfile: `${minutes}m`,
        scheduleWindowMinutes: minutes,
        seasonDurationMinutes: total,
        seasonStartsAt: "2099-10-20T17:00:20.168Z",
      });
      expect(data.publications).toHaveLength(9);
      expect(data.publications.every((publication) => publication.status === "scheduled")).toBe(
        true,
      );
      for (const [index, publication] of data.publications.entries()) {
        expect(publication.opensAfterMinutes).toBe(index * minutes);
        expect(publication.durationMinutes).toBe(minutes);
        expect(publication.opensAfterHours).toBe((index * minutes) / 60);
        const opensAt = index === 0 ? start : `${start} + interval '${index * minutes} minutes'`;
        const closesAt = `${start} + interval '${(index + 1) * minutes} minutes'`;
        expect(sql).toContain(`'scheduled', ${opensAt}, ${closesAt}`);
      }
      expect(sql).toContain(`'active', ${start}, ${start} + interval '${total} minutes'`);
      const versions = (value) =>
        value
          .split("insert into private.challenge_versions")[1]
          .split("insert into private.challenge_items")[0];
      expect(versions(sql)).toBe(versions(buildTabarniaDomainSql(input)));
    },
  );

  it("propagates a custom duration through the complete mocked Tabarnia setup", async () => {
    const dockerSql = vi.fn();
    const writeFixture = vi.fn();
    const startsAt = "2099-10-20T19:00:20.168+02:00";
    const output = await setupTabarniaDataset({
      schedule: "1h",
      startsAt,
      dependencies: {
        localSupabaseConfig: vi.fn(async () => ({
          url: "http://127.0.0.1:54321",
          dbContainer: "test-only",
        })),
        resetLocalDatabase: vi.fn(),
        removeFixture: vi.fn(),
        loadMiniWordleDictionary: vi.fn(),
        createFixedAuthAccounts: vi.fn(async () => accounts()),
        getMapMetadata: vi.fn(async () => ({})),
        getAvatarMetadata: vi.fn(async (user) => avatarMetadata()[user.label]),
        prepareSpainAssets: vi.fn(async () => ({ assets: spainAssets(), cleanup: vi.fn() })),
        uploadStorageObject: vi.fn(),
        dockerSql,
        writeFixture,
      },
    });
    expect(output).toMatchObject({
      scheduleProfile: "60m",
      scheduleWindowMinutes: 60,
      seasonDurationMinutes: 540,
    });
    expect(output.publications.every((publication) => publication.status === "scheduled")).toBe(
      true,
    );
    expect(dockerSql).toHaveBeenCalledOnce();
    expect(dockerSql.mock.calls[0][0]).toContain("interval '540 minutes'");
    expect(writeFixture).toHaveBeenCalledWith(
      "tabarnia",
      expect.objectContaining({ data: output }),
    );
  });

  it.each(["hourly", "0m", "-1h", "1.5h", "150000000000m", "20000000000m"])(
    "rejects %s before any external Tabarnia operation",
    async (schedule) => {
      const dependencies = Object.fromEntries(
        [
          "localSupabaseConfig",
          "resetLocalDatabase",
          "removeFixture",
          "loadMiniWordleDictionary",
          "createFixedAuthAccounts",
          "getMapMetadata",
          "getAvatarMetadata",
          "prepareSpainAssets",
          "uploadStorageObject",
          "removeStorageObject",
          "dockerSql",
          "writeFixture",
        ].map((name) => [name, vi.fn()]),
      );
      await expect(setupTabarniaDataset({ schedule, dependencies })).rejects.toThrow();
      for (const dependency of Object.values(dependencies))
        expect(dependency).not.toHaveBeenCalled();
    },
  );

  it("defines the fixed cohort and the requested roles", () => {
    expect(TABARNIA_USERS).toHaveLength(16);
    expect(TABARNIA_USERS.filter((user) => user.avatarFile).map((user) => user.avatarFile)).toEqual(
      [
        "ches.jpg",
        "dark.webp",
        "palmera.jpeg",
        "carlos.jpg",
        "kike.jpeg",
        "javi.jpg",
        "rielbe.jpeg",
        "alejandro.jpeg",
        "jacobo.jpeg",
        "lambda.jpeg",
        "jhon3d.jpg",
        "diego.jpg",
        "mimi.jpg",
        "lucas.jpg",
        "neak.jpeg",
      ],
    );
    expect(TABARNIA_USERS.filter((user) => !user.avatarFile).map((user) => user.label)).toEqual([
      "xesmona",
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

  describe("Multiverse solutions", () => {
    const cases = tabarniaMultiverseQuestions().map(({ points, ...document }, index) => ({
      letter: TABARNIA_FICTION_ALPHABET.entries[index].letter,
      points,
      document,
    }));

    function evaluationContext(
      { letter, points, document },
      answer = document.solutionPayload.correctAnswer,
    ) {
      return {
        receiptId: "00000000-0000-4000-8000-000000000001",
        questionVersionId: "00000000-0000-4000-8000-000000000002",
        receivedAt: "2026-10-29T00:00:00Z",
        questionType: document.type,
        payloadSchemaVersion: document.payloadSchemaVersion,
        publicPayload: document.publicPayload,
        solutionPayload: document.solutionPayload,
        timeLimitMs: document.timeLimitMs,
        itemPoints: points,
        itemConfigSchemaVersion: 1,
        itemConfig: { letter },
        mode: "alphabet",
        modeConfigSchemaVersion: 1,
        modeConfig: {},
        timeUsedMs: 0,
        timedOut: false,
        answer,
      };
    }

    it("generates all sixteen questions in order with their original weights", () => {
      expect(cases).toHaveLength(16);
      expect(cases.map(({ document }) => document.slug)).toEqual(
        TABARNIA_FICTION_ALPHABET.entries.map((entry) => entry.slug),
      );
      expect(cases.map(({ points }) => points)).toEqual([7, 7, 7, 7, ...Array(12).fill(6)]);
      expect(cases.reduce((total, { points }) => total + points, 0)).toBe(100);
    });

    it.each(cases)("validates the editorial document for letter $letter", ({ document }) => {
      expect(() => parseFlashEditorialQuestionDocument(document)).not.toThrow();
    });

    it.each(cases)("awards the full weight for the correct answer to letter $letter", (test) => {
      expect(supabaseCompetitiveEvaluator.evaluate(evaluationContext(test))).toEqual({
        status: "correct",
        points: test.points,
      });
    });

    it.each(cases)("rejects an incorrect answer to letter $letter", (test) => {
      expect(
        supabaseCompetitiveEvaluator.evaluate(evaluationContext(test, "Respuesta incorrecta")),
      ).toEqual({ status: "incorrect", points: 0 });
    });

    it.each([
      { letter: "A", answer: "Aladdín" },
      { letter: "A", answer: "Aladín" },
      { letter: "A", answer: "ALADDIN" },
      { letter: "C", answer: "CIRI" },
      { letter: "P", answer: "Pokemon" },
      { letter: "T", answer: "Tintin" },
    ])("accepts the original variant $answer for letter $letter", ({ letter, answer }) => {
      const test = cases.find((test) => test.letter === letter);
      expect(supabaseCompetitiveEvaluator.evaluate(evaluationContext(test, answer))).toEqual({
        status: "correct",
        points: test.points,
      });
    });

    it.each([
      { letter: "A", acceptedAnswers: ["Aladdin", "Aladdín", "Aladín"] },
      { letter: "C", acceptedAnswers: ["Cien años de soledad", "Cien anos de soledad"] },
      { letter: "P", acceptedAnswers: ["Pokémon", "Pokemon"] },
      { letter: "T", acceptedAnswers: ["Tintín", "Tintin"] },
    ])(
      "detects the original invalid solution for letter $letter",
      ({ letter, acceptedAnswers }) => {
        const test = structuredClone(cases.find((test) => test.letter === letter));
        test.document.solutionPayload.acceptedAnswers = acceptedAnswers;
        expect(() => supabaseCompetitiveEvaluator.evaluate(evaluationContext(test))).toThrow(
          "invalid_question_solution",
        );
      },
    );
  });

  describe("Tabarniaverso", () => {
    function correctAnswerFor({ solutionPayload }) {
      return (
        solutionPayload.correctAnswer ??
        solutionPayload.correctOrder ??
        solutionPayload.matches ??
        solutionPayload.categoriesByItem
      );
    }

    function evaluate(question, answer = correctAnswerFor(question)) {
      return supabaseCompetitiveEvaluator.evaluate({
        receiptId: "00000000-0000-4000-8000-000000000001",
        questionVersionId: "00000000-0000-4000-8000-000000000002",
        receivedAt: "2026-11-05T00:00:00Z",
        questionType: question.type,
        payloadSchemaVersion: question.payloadSchemaVersion,
        publicPayload: question.publicPayload,
        solutionPayload: question.solutionPayload,
        timeLimitMs: question.timeLimitMs,
        itemPoints: question.points,
        itemConfigSchemaVersion: 1,
        itemConfig: {},
        mode: "flash",
        modeConfigSchemaVersion: 1,
        modeConfig: {},
        timeUsedMs: 0,
        timedOut: false,
        answer,
      });
    }

    it("defines the agreed order, formats, answers, time limits and weights", () => {
      expect(
        TABARNIAVERSO_QUESTIONS.map((question) => [question.type, correctAnswerFor(question)]),
      ).toEqual([
        ["multiple-choice", "Patrice Désilets y Jade Raymond"],
        [
          "multiple-choice",
          "Acercarse al orgasmo y reducir o pausar la estimulación para retrasarlo.",
        ],
        ["multiple-choice", "Que tenga pito."],
        ["ordering", ["Troposfera", "Estratosfera", "Mesosfera", "Termosfera"]],
        ["estimation", 96],
        ["multiple-choice", "Betania"],
        ["multiple-choice", "Miller"],
        ["true-false", true],
        [
          "matching",
          { fenrir: "nordica", anubis: "egipcia", cerbero: "griega", quetzalcoatl: "mexica" },
        ],
        ["multiple-choice", "Circuito de Jerez"],
        ["short-text", "Canberra"],
        ["multiple-choice", "Dos"],
        ["multiple-choice", "Pokémon: Catch the Numbers!"],
        ["odd-one-out", "el-grito"],
        ["progressive-clues", "Petra"],
        [
          "classification",
          {
            Aire: "mezcla",
            Hierro: "elemento",
            "Agua destilada": "compuesto",
            Helio: "elemento",
            "Agua de mar": "mezcla",
            "Dióxido de carbono": "compuesto",
          },
        ],
      ]);
      expect(TABARNIAVERSO_QUESTIONS.map(({ timeLimitMs }) => timeLimitMs / 1_000)).toEqual([
        20, 20, 18, 22, 16, 14, 14, 12, 25, 20, 16, 20, 18, 20, 30, 30,
      ]);
      expect(TABARNIAVERSO_QUESTIONS.map(({ points }) => points)).toEqual([
        ...Array(4).fill(7),
        ...Array(12).fill(6),
      ]);
    });

    it.each(TABARNIAVERSO_QUESTIONS)("publishes and scores $slug", (question) => {
      const { points, ...document } = question;
      expect(() => parseFlashEditorialQuestionDocument(document)).not.toThrow();
      expect(evaluate(question)).toMatchObject({ status: "correct", points });
    });

    it("scores the Zelda estimates by distance and cuts off at four points", () => {
      const question = TABARNIAVERSO_QUESTIONS.find(
        ({ slug }) => slug === "tabarniaverso-ocarina-of-time",
      );
      expect(question.publicPayload).toMatchObject({
        min: 80,
        max: 100,
        step: 1,
        initialValue: 90,
        unit: "/100",
      });
      for (const answer of [95, 97]) {
        expect(evaluate(question, answer)).toMatchObject({ status: "partial", points: 5 });
      }
      for (const answer of [91, 92, 100]) {
        expect(evaluate(question, answer)).toMatchObject({ status: "incorrect", points: 0 });
      }
    });

    it("normalizes the single accepted spelling of Canberra", () => {
      const question = TABARNIAVERSO_QUESTIONS.find(
        ({ slug }) => slug === "tabarniaverso-capital-australia",
      );
      expect(question.solutionPayload.acceptedAnswers).toEqual(["Canberra"]);
      expect(evaluate(question, "canberra")).toMatchObject({ status: "correct", points: 6 });
      expect(evaluate(question, "Sídney")).toMatchObject({ status: "incorrect", points: 0 });
    });
  });

  it("generates nine sequential publications in the requested order without history", () => {
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
    expect(sql).toContain(
      "'open', date_trunc('minute', now()), date_trunc('minute', now()) + interval '24 hours'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '24 hours', date_trunc('minute', now()) + interval '48 hours'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '48 hours', date_trunc('minute', now()) + interval '72 hours'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '72 hours', date_trunc('minute', now()) + interval '96 hours'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '96 hours', date_trunc('minute', now()) + interval '120 hours'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '120 hours', date_trunc('minute', now()) + interval '144 hours'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '144 hours', date_trunc('minute', now()) + interval '168 hours'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '168 hours', date_trunc('minute', now()) + interval '192 hours'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '192 hours', date_trunc('minute', now()) + interval '216 hours'",
    );
    expect(sql).toContain("'superadmin'");
    expect(sql.match(/'owner'/g)).toHaveLength(1);
    expect(sql.match(/'member'/g)).toHaveLength(
      TABARNIA_USERS.filter((user) => user.role === "member").length,
    );
    expect(sql).toContain("'España'");
    expect(sql).toContain("'Multiverso friki'");
    expect(sql).toContain("'Cumbre lógica'");
    expect(sql).toContain("'Queens'");
    expect(sql).toContain("'Flow Free'");
    expect(sql).toContain("'La Biblia'");
    expect(sql).toContain("'Tabarniaverso'");
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
    expect(sql).toContain('"correctAnswer":"square-29"');
    expect(sql).toContain('"correctOptionId":"triangle-up"');
    expect(sql).toContain("avatars/00000003-0000-4000-8000-000000000000/");
    expect(sql.match(/update public\.players set avatar_path/g)).toHaveLength(15);
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

  it("builds an idempotent staging SQL transaction without taking over its transaction", () => {
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
      conflictSafe: true,
      wrapTransaction: false,
    });

    expect(sql).not.toMatch(/^begin;/);
    expect(sql).not.toContain("commit;");
    expect(sql.match(/on conflict \(id\) do nothing/gi)?.length).toBeGreaterThanOrEqual(9);
    expect(sql).toContain("on conflict (room_id, player_id) do nothing");
    expect(sql).toContain("on conflict (question_version_id) do nothing");
    expect(sql).toContain("set constraints all deferred");
    expect(sql).toContain("set constraints all immediate");
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

    expect(sql).toContain(
      "'open', date_trunc('minute', now()), date_trunc('minute', now()) + interval '5 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '5 minutes', date_trunc('minute', now()) + interval '10 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '10 minutes', date_trunc('minute', now()) + interval '15 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '15 minutes', date_trunc('minute', now()) + interval '20 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '20 minutes', date_trunc('minute', now()) + interval '25 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '25 minutes', date_trunc('minute', now()) + interval '30 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '30 minutes', date_trunc('minute', now()) + interval '35 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '35 minutes', date_trunc('minute', now()) + interval '40 minutes'",
    );
    expect(sql).toContain(
      "'scheduled', date_trunc('minute', now()) + interval '40 minutes', date_trunc('minute', now()) + interval '45 minutes'",
    );
    expect(sql).toContain(
      "'active', date_trunc('minute', now()), date_trunc('minute', now()) + interval '45 minutes'",
    );
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
      seasonDurationMinutes: 45,
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
      [40, 5],
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
    expect(uploadStorageObject).toHaveBeenCalledTimes(19);
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
      ["time-trial", 7, 100],
      ["survival", 20, 100],
      ["pyramid", 7, 100],
      ["alphabet", 16, 100],
      ["time-trial", 7, 100],
      ["pyramid", 7, 100],
      ["flash", 16, 100],
    ]);
    expect(output.publicationId).toBe(output.publications[0]?.id);
    expect(output.publications.map((publication) => publication.title)).toEqual([
      "Steel Ball Run",
      "Reino de animales",
      "Queens",
      "España",
      "Cumbre lógica",
      "Multiverso friki",
      "Flow Free",
      "La Biblia",
      "Tabarniaverso",
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
      "scheduled",
    ]);
    expect(output.avatars).toHaveLength(15);
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
    expect(removeStorageObject).toHaveBeenCalledTimes(19);
    expect(cleanupSpainAssets).toHaveBeenCalledOnce();
    expect(saveFixture).not.toHaveBeenCalled();
  });
});
