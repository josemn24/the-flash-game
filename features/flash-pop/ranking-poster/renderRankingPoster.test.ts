// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRankingPosterSvg,
  generateRankingPoster,
  resolveLocalStorageAvatarUrl,
  type RankingPosterEntry,
  type RankingPosterInput,
} from "./renderRankingPoster";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function entry(rank: number, name: string, flashPoints: number): RankingPosterEntry {
  return {
    rank,
    memberId: `member-${rank}`,
    name,
    initials: name.slice(0, 2).toUpperCase(),
    avatarSrc: undefined,
    flashPoints,
  };
}

function input(ranking: readonly RankingPosterEntry[]): RankingPosterInput {
  return {
    roomTitle: "Tabarnia",
    challengeTitle: "Cumbre lógica",
    playedAt: "2026-10-31T10:00:00.000Z",
    ranking,
  };
}

describe("ranking poster renderer", () => {
  it("shows the empty state without fictitious names or scores", () => {
    const svg = buildRankingPosterSvg(input([]));

    expect(svg).toContain("Todavía no hay resultados");
    expect(svg).not.toContain("RANKING DE EJEMPLO");
    expect(svg).not.toContain("PUNTUACIONES FICTICIAS");
  });

  it("uses initials when a participant has no usable avatar", () => {
    const svg = buildRankingPosterSvg(input([entry(1, "Dark", 98)]));

    expect(svg).toContain(">DA</text>");
  });

  it.each([
    [1, [entry(1, "Dark", 98)]],
    [2, [entry(1, "Dark", 98), entry(2, "Palmera", 94)]],
  ] as const)("renders the podium for %i participant(s)", (_count, ranking) => {
    const svg = buildRankingPosterSvg(input(ranking));

    for (const player of ranking) {
      expect(svg).toContain(player.name);
      expect(svg).toContain(`${player.flashPoints} pts`);
    }
    expect(svg).not.toContain("RANKING DE EJEMPLO");
  });

  it("keeps the official order and displays all fourteen entries and scores", () => {
    const names = [
      "Dark",
      "Palmera",
      "Carlos",
      "Kike",
      "Javi",
      "Rielbe",
      "Alejandro",
      "Jacobo",
      "Lambda",
      "Jhon3D",
      "Diego",
      "Mimi",
      "Lucas",
      "Neak",
    ];
    const ranking = names.map((name, index) => entry(index + 1, name, 100 - index));
    const svg = buildRankingPosterSvg(input(ranking));

    expect(svg.indexOf("Dark")).toBeLessThan(svg.indexOf("Palmera"));
    expect(svg.indexOf("Palmera")).toBeLessThan(svg.indexOf("Carlos"));
    for (const player of ranking) {
      expect(svg).toContain(player.name);
      expect(svg).toContain(`${player.flashPoints} pts`);
    }
  });

  it("returns a 1080 by 1920 PNG", async () => {
    const ranking = [entry(1, "Dark", 98)];
    const png = await generateRankingPoster(input(ranking));
    const repeatedPng = await generateRankingPoster(input(ranking));
    const metadata = await sharp(png).metadata();

    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(metadata).toMatchObject({ format: "png", width: 1080, height: 1920 });
    expect(png).toEqual(repeatedPng);
  }, 15_000);

  it("resolves only local public avatar proxy URLs in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    const localAvatarProxy =
      "/__local-supabase/storage/v1/object/public/avatars/avatars/player/avatar.png";

    expect(resolveLocalStorageAvatarUrl(localAvatarProxy)).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/avatars/avatars/player/avatar.png",
    );
    expect(
      resolveLocalStorageAvatarUrl(
        "/__local-supabase/storage/v1/object/public/question-assets/private.png",
      ),
    ).toBeNull();
  });

  it("loads avatars through the local Storage proxy instead of showing initials", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    const avatarBytes = await readFile(path.resolve("public/flash-pop/avatars/dark.webp"));
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return new Response(avatarBytes, {
        headers: {
          "Content-Length": String(avatarBytes.byteLength),
          "Content-Type": "image/webp",
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const posterEntry = {
      ...entry(1, "Dark", 52),
      avatarSrc: "/__local-supabase/storage/v1/object/public/avatars/avatars/player/avatar.png",
    };

    const withAvatar = await generateRankingPoster(input([posterEntry]));
    const withInitials = await generateRankingPoster(input([entry(1, "Dark", 52)]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrls).toEqual([
      "http://127.0.0.1:54321/storage/v1/object/public/avatars/avatars/player/avatar.png",
    ]);
    expect(withAvatar.equals(withInitials)).toBe(false);
  });
});
