import { describe, expect, it, vi } from "vitest";
import { BETA_VIP_ALPHABET } from "./fixtures/scenarios/betavip-alphabet.mjs";
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

  it("publishes the Alphabet first and reuses Tabarnia's Steel Ball Run version second", () => {
    const data = betaVipManifest(tabarniaFixture);
    const sql = buildBetaVipDomainSql({ tabarniaFixture, accounts: newAccounts });

    expect(data.room.slug).toBe("beta-vip");
    expect(data.tabarnia.room).toEqual(tabarniaFixture.data.room);
    expect(data.tabarnia.steelBallRunPublicationId).toBe("publication-tabarnia-sbr");
    expect(data.publicationId).toBe(data.publications[0].id);
    expect(data.challengeVersionId).toBe(data.publications[0].challengeVersionId);
    expect(
      data.publications.map((item) => [item.number, item.title, item.mode, item.status]),
    ).toEqual([
      [1, "La vuelta al mundo", "alphabet", "open"],
      [2, "Steel Ball Run", "flash", "scheduled"],
    ]);
    expect(data.publications.map((item) => item.pointsTotal)).toEqual([100, 100]);
    expect(data.publications.map((item) => item.questionCount)).toEqual([18, 16]);
    expect(data.steelBallRunPublicationId).toBe(data.publications[1].id);
    expect(data.steelBallRunPublicationId).not.toBe(data.tabarnia.steelBallRunPublicationId);
    expect(data.publications[1].challengeVersionId).toBe("version-sbr");
    expect(sql).toContain("'BetaVIP'");
    expect(sql).toContain("'Temporada BetaVIP'");
    expect(sql).toContain("'version-sbr'");
    expect(sql).toContain("'La vuelta al mundo'");
    expect(sql).toContain("'alphabet'");
    expect(sql).toContain("'short-text'");
    expect(sql).toContain("'active', now(), now() + interval '48 hours'");
    expect(sql).toContain("'open', now(), now() + interval '24 hours'");
    expect(sql).toContain("'scheduled', now() + interval '24 hours', now() + interval '48 hours'");
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
    expect(sql).not.toContain("media_assets");
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
        },
      }),
    ).rejects.toThrow("BetaVIP SQL failed");
    expect(writeFixture).not.toHaveBeenCalled();
  });
});
