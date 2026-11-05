import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderAsync } from "@resvg/resvg-js";
import sharp from "sharp";
import { LOCAL_STORAGE_OBJECT_PATH, STORAGE_OBJECT_PATH } from "@/lib/media/storageUrlPaths";
import type { RoomDailyLeaderboardEntry } from "@/types/view-models/room";

const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1920;
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const PUBLIC_ROOT = path.resolve(process.cwd(), "public");
const LOGO_PATH = path.join(PUBLIC_ROOT, "the-flash-tabarnia-edition.png");
// Static fonts from https://github.com/aaronbell/manrope/tree/6f81ebe/fonts/ttf
const POSTER_FONT_ROOT = path.join(process.cwd(), "features/flash-pop/ranking-poster/fonts");
const POSTER_FONT_FILES = [
  path.join(POSTER_FONT_ROOT, "manrope-regular.ttf"),
  path.join(POSTER_FONT_ROOT, "manrope-bold.ttf"),
];

export type RankingPosterEntry = Pick<
  RoomDailyLeaderboardEntry,
  "rank" | "memberId" | "name" | "initials" | "avatarSrc" | "flashPoints"
>;

export type RankingPosterInput = {
  readonly roomTitle: string;
  readonly challengeTitle: string;
  readonly playedAt: string;
  readonly ranking: readonly RankingPosterEntry[];
};

type PosterAssets = {
  readonly logoDataUri: string | null;
  readonly avatars: ReadonlyMap<string, string>;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function initialsFor(entry: RankingPosterEntry) {
  const value = entry.initials.trim();
  if (value) return value.slice(0, 3).toUpperCase();
  return entry.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(date);
}

function wrapTitle(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > 25 && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length > 2) {
    const last = `${lines[1]} ${lines.slice(2).join(" ")}`;
    lines.splice(1, lines.length - 1, last.length > 28 ? `${last.slice(0, 27).trimEnd()}…` : last);
  }
  return lines.length ? lines : ["Desafío"];
}

function fontSizeForName(name: string, maxWidth: number, preferred: number) {
  const estimatedWidth = name.length * preferred * 0.59;
  return estimatedWidth > maxWidth
    ? Math.max(16, Math.floor((maxWidth / estimatedWidth) * preferred))
    : preferred;
}

function avatarMarkup(
  entry: RankingPosterEntry,
  index: number,
  centerX: number,
  centerY: number,
  radius: number,
  avatarDataUri?: string,
) {
  const clipId = `avatar-clip-${index}`;
  const content = avatarDataUri
    ? `<image href="${avatarDataUri}" x="${centerX - radius}" y="${centerY - radius}" width="${radius * 2}" height="${radius * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
    : `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="#25213f"/><text x="${centerX}" y="${centerY + radius * 0.34}" text-anchor="middle" fill="#f8f5ff" font-size="${Math.floor(radius * 0.72)}" font-weight="800">${escapeXml(initialsFor(entry))}</text>`;

  return `<defs><clipPath id="${clipId}"><circle cx="${centerX}" cy="${centerY}" r="${radius}"/></clipPath></defs><circle cx="${centerX}" cy="${centerY}" r="${radius + 12}" fill="#6749e8"/><circle cx="${centerX}" cy="${centerY}" r="${radius + 5}" fill="#d8ff19"/>${content}`;
}

function podiumMarkup(entries: readonly RankingPosterEntry[], assets: PosterAssets) {
  const blocks = [
    { top: 626, color: "#caff12", stroke: "#f2ffab", numberColor: "#121126" },
    { top: 661, color: "#453776", stroke: "#8870ff", numberColor: "#f5f0ff" },
    { top: 687, color: "#352d59", stroke: "#6e57e7", numberColor: "#f5f0ff" },
  ];
  const layouts =
    entries.length === 3
      ? [
          { x: 540, avatarY: 448 },
          { x: 190, avatarY: 474 },
          { x: 890, avatarY: 488 },
        ]
      : entries.length === 2
        ? [
            { x: 720, avatarY: 458 },
            { x: 360, avatarY: 478 },
          ]
        : [{ x: 540, avatarY: 450 }];

  return entries
    .map((entry, index) => {
      const layout = layouts[index] ?? layouts[0]!;
      const x = layout.x;
      const avatarY = layout.avatarY;
      const block = blocks[index] ?? blocks[2]!;
      const isWinner = index === 0;
      const radius = isWinner ? 68 : 58;
      const avatar = avatarMarkup(
        entry,
        index,
        x,
        avatarY,
        radius,
        assets.avatars.get(entry.memberId ?? entry.name),
      );
      const nameSize = fontSizeForName(entry.name, 290, isWinner ? 31 : 28);
      const scoreSize = isWinner ? 29 : 26;
      const place = `${entry.rank}.º`;
      return `<g>
        ${avatar}
        <text x="${x}" y="574" text-anchor="middle" fill="#fbf9ff" font-size="${nameSize}" font-weight="800">${escapeXml(entry.name)}</text>
        <text x="${x}" y="612" text-anchor="middle" fill="#d8ff19" font-size="${scoreSize}" font-weight="800">${entry.flashPoints} pts</text>
        <rect x="${x - 145}" y="${block.top}" width="290" height="130" rx="25" fill="${block.color}" stroke="${block.stroke}" stroke-width="3"/>
        <text x="${x}" y="${block.top + 88}" text-anchor="middle" fill="${block.numberColor}" font-size="66" font-weight="900">${escapeXml(place)}</text>
      </g>`;
    })
    .join("");
}

function standingsMarkup(entries: readonly RankingPosterEntry[], assets: PosterAssets) {
  if (!entries.length) return "";

  const listStartY = 883;
  const availableHeight = 834;
  const rowPitch = Math.min(78, Math.floor(availableHeight / entries.length));
  const rowHeight = Math.max(32, rowPitch - 6);
  const nameSize = Math.min(26, Math.max(16, Math.floor(rowHeight * 0.38)));
  const avatarRadius = Math.min(25, Math.max(16, Math.floor(rowHeight * 0.34)));

  return entries
    .map((entry, index) => {
      const top = listStartY + index * rowPitch;
      const midY = top + rowHeight / 2;
      const avatar = avatarMarkup(
        entry,
        index + 10,
        142,
        midY,
        avatarRadius,
        assets.avatars.get(entry.memberId ?? entry.name),
      );
      const nameFontSize = fontSizeForName(entry.name, 690, nameSize);
      return `<g>
        <rect x="36" y="${top}" width="1008" height="${rowHeight}" rx="${Math.min(20, rowHeight / 2)}" fill="#211e35" stroke="#46406e" stroke-width="2"/>
        <text x="62" y="${midY + nameSize * 0.35}" fill="#d8ff19" font-size="${nameSize}" font-weight="800">${String(entry.rank).padStart(2, "0")}</text>
        ${avatar}
        <text x="188" y="${midY + nameFontSize * 0.34}" fill="#faf8ff" font-size="${nameFontSize}" font-weight="750">${escapeXml(entry.name)}</text>
        <text x="1008" y="${midY + nameSize * 0.34}" text-anchor="end" fill="#c7baff" font-size="${nameSize}" font-weight="750">${entry.flashPoints} pts</text>
      </g>`;
    })
    .join("");
}

export function buildRankingPosterSvg(
  input: RankingPosterInput,
  assets: PosterAssets = { logoDataUri: null, avatars: new Map() },
) {
  const titleLines = wrapTitle(input.challengeTitle);
  const titleMarkup = titleLines
    .map((line, index) => {
      const baseline = titleLines.length === 1 ? 302 : 275 + index * 58;
      return `<text x="540" y="${baseline}" text-anchor="middle" fill="#fbf9ff" font-size="58" font-weight="900" letter-spacing="-1.5">${escapeXml(line)}</text>`;
    })
    .join("");
  const orderedTop = input.ranking.slice(0, 3);
  const orderedRest = input.ranking.slice(3);
  const date = formatDate(input.playedAt);
  const roomLabel = input.roomTitle.trim();
  const logoMarkup = assets.logoDataUri
    ? `<image href="${assets.logoDataUri}" x="385" y="18" width="310" height="175" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="540" y="112" text-anchor="middle" fill="#d8ff19" font-size="40" font-weight="900">THE FLASH</text><text x="540" y="148" text-anchor="middle" fill="#a58dff" font-size="19" font-weight="800" letter-spacing="4">TABARNIA EDITION</text>`;
  const podium = orderedTop.length ? podiumMarkup(orderedTop, assets) : "";
  const standings = standingsMarkup(orderedRest, assets);
  const emptyState = input.ranking.length
    ? ""
    : `<rect x="118" y="520" width="844" height="180" rx="28" fill="#211e35" stroke="#514594" stroke-width="3"/><text x="540" y="595" text-anchor="middle" fill="#f7f4ff" font-size="30" font-weight="700">Todavía no hay resultados</text><text x="540" y="643" text-anchor="middle" fill="#bdb5da" font-size="22">Este desafío cerró sin intentos registrados.</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}" font-family="Manrope">
    <defs>
      <radialGradient id="bg-glow" cx="50%" cy="40%" r="72%"><stop offset="0" stop-color="#292048"/><stop offset="0.58" stop-color="#111020"/><stop offset="1" stop-color="#090912"/></radialGradient>
      <linearGradient id="streak" x1="0" x2="1"><stop stop-color="#d8ff19" stop-opacity="0"/><stop offset="0.52" stop-color="#d8ff19" stop-opacity="0.9"/><stop offset="1" stop-color="#d8ff19" stop-opacity="0"/></linearGradient>
      <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12"/></filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#bg-glow)"/>
    <path d="M-35 128 L350 248" stroke="url(#streak)" stroke-width="14" opacity="0.75"/><path d="M1110 155 L745 255" stroke="url(#streak)" stroke-width="14" opacity="0.75"/>
    <path d="M-50 788 L290 676" stroke="#885cff" stroke-width="9" opacity="0.24"/><path d="M1130 756 L805 658" stroke="#885cff" stroke-width="9" opacity="0.24"/>
    <circle cx="540" cy="632" r="330" fill="#6e4bdf" opacity="0.09" filter="url(#soft-glow)"/>
    ${logoMarkup}
    <text x="540" y="222" text-anchor="middle" fill="#c5bcdf" font-size="19" font-weight="800" letter-spacing="4">RESULTADO DEL DESAFÍO</text>
    ${titleMarkup}
    <text x="540" y="356" text-anchor="middle" fill="#a99fca" font-size="19" font-weight="650">${escapeXml(roomLabel)}${date ? ` · ${escapeXml(date)}` : ""}</text>
    ${podium}
    ${emptyState}
    ${orderedRest.length ? `<text x="48" y="850" fill="#fbf9ff" font-size="23" font-weight="850" letter-spacing="2.5">CLASIFICACIÓN</text><text x="1032" y="850" text-anchor="end" fill="#d8ff19" font-size="18" font-weight="850" letter-spacing="2">PUNTOS</text>${standings}` : ""}
    <text x="540" y="1854" text-anchor="middle" fill="#aaa2c7" font-size="17" font-weight="750" letter-spacing="2.5">THE FLASH · ${escapeXml(roomLabel.toUpperCase())} · CLASIFICACIÓN OFICIAL</text>
  </svg>`;
}

async function readLocalAvatar(source: string) {
  if (!source.startsWith("/flash-pop/avatars/")) return null;
  const pathname = new URL(source, "http://localhost").pathname;
  const filePath = path.resolve(PUBLIC_ROOT, `.${pathname}`);
  if (!filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`)) return null;
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

export function resolveLocalStorageAvatarUrl(source: string) {
  if (process.env.NODE_ENV !== "development") return null;

  const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredSupabaseUrl) return null;

  let proxyUrl: URL;
  let supabaseUrl: URL;
  try {
    proxyUrl = new URL(source, "http://localhost");
    supabaseUrl = new URL(configuredSupabaseUrl);
  } catch {
    return null;
  }

  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(supabaseUrl.hostname) ||
    !proxyUrl.pathname.startsWith(`${LOCAL_STORAGE_OBJECT_PATH}public/avatars/`)
  ) {
    return null;
  }

  const objectPath = proxyUrl.pathname.slice(LOCAL_STORAGE_OBJECT_PATH.length);
  const storageUrl = new URL(`${STORAGE_OBJECT_PATH}${objectPath}`, supabaseUrl);
  storageUrl.search = proxyUrl.search;
  return storageUrl.toString();
}

async function readAvatarSource(source: string) {
  if (!source.startsWith("/")) return readRemoteAvatar(source);
  const localBytes = await readLocalAvatar(source);
  if (localBytes) return localBytes;
  const upstreamUrl = resolveLocalStorageAvatarUrl(source);
  return upstreamUrl ? readRemoteAvatar(upstreamUrl) : null;
}

async function readRemoteAvatar(source: string) {
  const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredSupabaseUrl) return null;

  let expectedOrigin: string;
  let avatarUrl: URL;
  try {
    expectedOrigin = new URL(configuredSupabaseUrl).origin;
    avatarUrl = new URL(source);
  } catch {
    return null;
  }

  if (
    avatarUrl.origin !== expectedOrigin ||
    !avatarUrl.pathname.startsWith("/storage/v1/object/public/avatars/")
  ) {
    return null;
  }

  try {
    const response = await fetch(avatarUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(3_000),
    });
    const contentType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase();
    if (!response.ok || !contentType || !ALLOWED_AVATAR_TYPES.has(contentType)) {
      return null;
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_AVATAR_BYTES) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_AVATAR_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, totalBytes);
  } catch {
    return null;
  }
}

async function toPngDataUri(bytes: Buffer) {
  try {
    const normalized = await sharp(bytes, { limitInputPixels: 5_000_000 })
      .rotate()
      .resize(256, 256, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${normalized.toString("base64")}`;
  } catch {
    return null;
  }
}

async function loadPosterAssets(ranking: readonly RankingPosterEntry[]): Promise<PosterAssets> {
  let logoDataUri: string | null = null;
  try {
    const logo = await readFile(LOGO_PATH);
    const normalizedLogo = await sharp(logo, { limitInputPixels: 5_000_000 })
      .resize(520, 293, { fit: "inside" })
      .png()
      .toBuffer();
    logoDataUri = `data:image/png;base64,${normalizedLogo.toString("base64")}`;
  } catch {
    logoDataUri = null;
  }

  const avatars = new Map<string, string>();
  await Promise.all(
    ranking.map(async (entry) => {
      if (!entry.avatarSrc) return;
      const key = entry.memberId ?? entry.name;
      const bytes = await readAvatarSource(entry.avatarSrc);
      if (!bytes || bytes.length > MAX_AVATAR_BYTES) return;
      const dataUri = await toPngDataUri(bytes);
      if (dataUri) avatars.set(key, dataUri);
    }),
  );
  return { logoDataUri, avatars };
}

export async function generateRankingPoster(input: RankingPosterInput) {
  const assets = await loadPosterAssets(input.ranking);
  const svg = buildRankingPosterSvg(input, assets);
  const image = await renderAsync(svg, {
    font: { fontFiles: POSTER_FONT_FILES, loadSystemFonts: false },
  });
  return Buffer.from(image.asPng());
}
