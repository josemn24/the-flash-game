import { getRoomHistoryDetailPageModel } from "@/server/production-room-data-access";
import { generateRankingPoster } from "@/features/flash-pop/ranking-poster/renderRankingPoster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ roomId: string; challengeId: string }>;
};

function errorResponse(error: string, status: number) {
  return Response.json(
    { error },
    {
      status,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    },
  );
}

function safeFilePart(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "desafio"
  );
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { roomId, challengeId } = await params;
  try {
    const model = await getRoomHistoryDetailPageModel(roomId, challengeId);

    if (!model) return errorResponse("ranking_not_found", 404);
    if (!model.canExportRankingPoster) return errorResponse("forbidden", 403);
    if (model.ranking.length === 0) return errorResponse("ranking_empty", 409);

    const png = await generateRankingPoster({
      roomTitle: model.roomTitle,
      challengeTitle: model.entry.title,
      playedAt: model.entry.playedAt,
      ranking: model.ranking,
    });
    const filename = `ranking-${safeFilePart(roomId)}-${safeFilePart(model.entry.title)}.png`;

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return errorResponse("ranking_poster_unavailable", 503);
  }
}
