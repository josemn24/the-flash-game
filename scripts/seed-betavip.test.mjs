import { describe, expect, it, vi } from "vitest";
import { validateQuestionTags } from "../lib/questionTags.ts";
import { BETA_VIP_ALPHABET } from "./fixtures/scenarios/betavip-alphabet.mjs";
import {
  BETA_VIP_SURVIVAL,
  betaVipSurvivalQuestions,
} from "./fixtures/scenarios/betavip-survival.mjs";
import {
  BETA_VIP_PYRAMID,
  betaVipPyramidQuestions,
} from "./fixtures/scenarios/betavip-pyramid.mjs";
import { betaVipManifest, buildBetaVipDomainSql, setupBetaVipDataset } from "./seed-betavip.mjs";

const tabarniaFixture = {
  users: {
    xesmona: { email: "xesmona@example.test", password: "local-only", playerId: "player-xesmona" },
    ches: { email: "ches@example.test", password: "local-only", playerId: "player-ches" },
    dark: { email: "dark@example.test", password: "local-only", playerId: "player-dark" },
  },
  data: {
    room: { id: "room-tabarnia", slug: "tabarnia" },
    seasonId: "season-tabarnia",
    publications: [
      { id: "publication-animals", slug: "animals-alphabet-definition", mode: "alphabet" },
      {
        id: "publication-tabarnia-sbr",
        slug: "steel-ball-run",
        title: "Steel Ball Run",
        mode: "flash",
        challengeId: "challenge-sbr",
        challengeVersionId: "version-sbr",
        questionCount: 16,
        pointsTotal: 100,
      },
    ],
  },
};

const newAccounts = {
  manuel: { email: "manuel@example.test", password: "local-only", playerId: "player-manuel" },
  genis: { email: "genis@example.test", password: "local-only", playerId: "player-genis" },
};
const cassetteAssetMetadata = { byteSize: 2048, sha256: "a".repeat(64) };
const prepareCassetteAsset = async () => ({
  filePath: "/tmp/betavip-cassette.png",
  metadata: cassetteAssetMetadata,
  cleanup: vi.fn(),
});

describe("BetaVIP seed", () => {
  it("defines eighteen playable geography letters with the agreed answers", () => {
    const entries = BETA_VIP_ALPHABET.entries;
    expect(entries.map((entry) => entry.letter)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
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
    expect(new Set(entries.map((entry) => entry.letter)).size).toBe(18);
    expect(
      entries.every((entry) => entry.correctAnswer.toUpperCase().startsWith(entry.letter)),
    ).toBe(true);
    expect(entries.every((entry) => entry.acceptedAnswers.includes(entry.correctAnswer))).toBe(
      true,
    );
    expect(entries.filter((entry) => entry.topic === "countries")).toHaveLength(4);
    expect(entries.filter((entry) => entry.topic === "capitals")).toHaveLength(3);
    expect(entries.filter((entry) => entry.topic === "physical_geography")).toHaveLength(11);
    expect(
      entries
        .filter((entry) => entry.topic === "physical_geography")
        .every((entry) => entry.acceptedAnswers.length === 2),
    ).toBe(true);
    expect(entries.find((entry) => entry.letter === "T")?.acceptedAnswers).toEqual([
      "Tokio",
      "Tokyo",
    ]);
    expect(BETA_VIP_ALPHABET.globalTimeLimitMs).toBe(135_000);
  });

  it("defines twenty survival questions with five per topic and interleaved clues", () => {
    const questions = betaVipSurvivalQuestions("00000000-0000-4000-8000-000000000001");
    expect(BETA_VIP_SURVIVAL.modeConfig).toEqual({ lives: 3 });
    expect(questions).toHaveLength(20);
    expect(new Set(questions.map((item) => item.slug)).size).toBe(20);
    expect(questions.map((item) => item.points)).toEqual([4, ...Array(18).fill(5), 6]);
    expect(questions.reduce((total, item) => total + item.points, 0)).toBe(100);
    for (const topic of ["Cine", "Series", "Música", "Videojuegos"]) {
      expect(questions.filter((item) => item.topic === topic)).toHaveLength(5);
    }
    expect(
      questions.filter((item) => item.type === "progressive-clues").map((item) => item.position),
    ).toEqual([5, 10, 14, 18]);
    expect(questions.find((item) => item.position === 3)).toMatchObject({
      type: "progressive-image",
      publicPayload: { revealDurationMs: 7000 },
      solutionPayload: { acceptedAnswers: ["casete", "cassette", "cinta de casete"] },
    });
    expect(
      questions
        .filter((item) => item.type === "progressive-clues")
        .every((item) => item.publicPayload.cluePenalty === 30),
    ).toBe(true);
    expect(
      questions.every((item) => !JSON.stringify(item.publicPayload).includes("correctAnswer")),
    ).toBe(true);
    expect(questions.every((item) => validateQuestionTags(item.publicPayload.tags).valid)).toBe(
      true,
    );
  });

  it("publishes Cumbre lógica II, Survival and Alphabet on consecutive days", () => {
    const data = betaVipManifest(tabarniaFixture);
    const sql = buildBetaVipDomainSql({
      tabarniaFixture,
      accounts: newAccounts,
      cassetteAssetMetadata,
    });

    expect(data.room.slug).toBe("beta-vip");
    expect(data.tabarnia.room).toEqual(tabarniaFixture.data.room);
    expect(data.tabarnia.steelBallRunPublicationId).toBe("publication-tabarnia-sbr");
    expect(data.publicationId).toBe(data.publications[0].id);
    expect(data.challengeId).toBe(data.publications[0].challengeId);
    expect(data.challengeVersionId).toBe(data.publications[0].challengeVersionId);
    expect(betaVipPyramidQuestions).toHaveLength(7);
    expect(betaVipPyramidQuestions.map((item) => item.type)).toEqual([
      "odd-one-out",
      "logic-matrix",
      "zip",
      "connect-pairs",
      "escape",
      "logic-code",
      "queens",
    ]);
    expect(betaVipPyramidQuestions.reduce((total, item) => total + item.points, 0)).toBe(100);
    expect(BETA_VIP_PYRAMID.modeConfig).toEqual({});
    expect(
      data.publications.map((item) => [item.number, item.title, item.mode, item.status]),
    ).toEqual([
      [1, "Cumbre lógica II", "pyramid", "open"],
      [2, "Supervivencia: Cultura pop", "survival", "scheduled"],
      [3, "La vuelta al mundo", "alphabet", "scheduled"],
    ]);
    expect(data.publications.map((item) => item.opensAfterHours)).toEqual([0, 24, 48]);
    expect(data.publications.map((item) => item.pointsTotal)).toEqual([100, 100, 100]);
    expect(data.publications.map((item) => item.questionCount)).toEqual([7, 20, 18]);
    expect(data.pyramidPublicationId).toBe(data.publications[0].id);
    expect(data.survivalPublicationId).toBe(data.publications[1].id);
    expect(data.alphabetPublicationId).toBe(data.publications[2].id);
    expect(data.publications.some((item) => item.slug === "steel-ball-run")).toBe(false);
    expect(sql).toContain("'BetaVIP'");
    expect(sql).toContain("'Temporada BetaVIP'");
    expect(sql).not.toContain("publication:beta-vip-steel-ball-run");
    expect(sql).toContain("'La vuelta al mundo'");
    expect(sql).toContain("'alphabet'");
    expect(sql).toContain("'short-text'");
    expect(sql).toContain("'active', now(), now() + interval '72 hours'");
    expect(sql).toContain("'open', now(), now() + interval '24 hours'");
    expect(sql).toContain("'scheduled', now() + interval '24 hours', now() + interval '48 hours'");
    expect(sql).toContain("'scheduled', now() + interval '48 hours', now() + interval '72 hours'");
    expect(sql).toContain("'Cumbre lógica II'");
    expect(sql).toContain("'pyramid'");
    expect(sql).toContain("'connect-pairs'");
    for (const [publication, status, start, end] of [
      [data.publications[0], "open", "now()", "now() + interval '24 hours'"],
      [
        data.publications[1],
        "scheduled",
        "now() + interval '24 hours'",
        "now() + interval '48 hours'",
      ],
      [
        data.publications[2],
        "scheduled",
        "now() + interval '48 hours'",
        "now() + interval '72 hours'",
      ],
    ]) {
      expect(sql).toContain(
        `('${publication.id}', '${data.seasonId}', '${publication.challengeVersionId}', ${publication.number},\n   '${status}', ${start}, ${end})`,
      );
    }
    expect(sql.match(/'owner', 'active'/g)).toHaveLength(1);
    expect(sql.match(/'member', 'active'/g)).toHaveLength(3);
    for (const playerId of ["player-ches", "player-dark", "player-manuel", "player-genis"]) {
      expect(sql).toContain(`'${playerId}'`);
    }
    const membershipSql = sql
      .split("insert into public.room_memberships")[1]
      .split("insert into public.seasons")[0];
    expect(membershipSql).not.toContain("player-xesmona");
    expect(sql).toContain("player-xesmona");
    expect(sql).toContain("insert into private.question_definitions");
    expect(sql).toContain("insert into private.challenge_definitions");
    expect(sql).toContain("insert into private.media_assets");
    expect(sql).toContain("private.assert_supported_calendar_content");
    expect(sql).not.toContain("insert into public.attempts");
  });

  it("creates both rooms and writes BetaVIP only after its SQL succeeds", async () => {
    const setupTabarniaDataset = vi.fn();
    const readFixture = vi.fn(async () => tabarniaFixture);
    const createAuthAccounts = vi.fn(async () => newAccounts);
    const dockerSql = vi.fn();
    const writeFixture = vi.fn();

    await setupBetaVipDataset({
      dependencies: {
        setupTabarniaDataset,
        readFixture,
        localSupabaseConfig: async () => ({ dbContainer: "local-db" }),
        createAuthAccounts,
        dockerSql,
        writeFixture,
        prepareCassetteAsset,
        uploadStorageObject: vi.fn(),
        removeStorageObject: vi.fn(),
      },
    });

    expect(setupTabarniaDataset).toHaveBeenCalledOnce();
    expect(readFixture).toHaveBeenCalledWith("tabarnia");
    expect(createAuthAccounts.mock.calls[0][0]).toMatchObject({
      id: "betavip",
      users: [
        { label: "manuel", displayName: "Manuel" },
        { label: "genis", displayName: "Genís" },
      ],
    });
    expect(dockerSql).toHaveBeenCalledOnce();
    expect(writeFixture).toHaveBeenCalledWith(
      "betavip",
      expect.objectContaining({
        scenario: "betavip",
        users: expect.objectContaining({
          xesmona: tabarniaFixture.users.xesmona,
          ches: tabarniaFixture.users.ches,
          dark: tabarniaFixture.users.dark,
          manuel: expect.objectContaining({ playerId: "player-manuel" }),
          genis: expect.objectContaining({ playerId: "player-genis" }),
        }),
      }),
    );
    expect(dockerSql.mock.invocationCallOrder[0]).toBeLessThan(
      writeFixture.mock.invocationCallOrder[0],
    );
  });

  it("does not write the BetaVIP manifest when SQL fails", async () => {
    const writeFixture = vi.fn();
    const removeStorageObject = vi.fn();
    await expect(
      setupBetaVipDataset({
        dependencies: {
          setupTabarniaDataset: vi.fn(),
          readFixture: async () => tabarniaFixture,
          localSupabaseConfig: async () => ({ dbContainer: "local-db" }),
          createAuthAccounts: async () => newAccounts,
          dockerSql: async () => {
            throw new Error("BetaVIP SQL failed");
          },
          writeFixture,
          prepareCassetteAsset,
          uploadStorageObject: vi.fn(),
          removeStorageObject,
        },
      }),
    ).rejects.toThrow("BetaVIP SQL failed");
    expect(writeFixture).not.toHaveBeenCalled();
    expect(removeStorageObject).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ bucket: "question-assets", contentType: "image/png" }),
    );
  });
});
