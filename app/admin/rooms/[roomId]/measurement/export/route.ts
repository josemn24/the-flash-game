import { roomMeasurement } from "@/server/product/room-measurement";
import { SEASON_CSV_DATASETS, type SeasonCsvDataset } from "@/lib/seasonMeasurement";
import { productError } from "@/server/product/http";
import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
} from "@/application/administration/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const query = new URL(request.url).searchParams;
    const dataset = query.get("dataset") as SeasonCsvDataset;
    if (!SEASON_CSV_DATASETS.includes(dataset)) throw new Error("invalid_dataset");
    const seasonId = query.get("season") ?? "";
    const csv = await roomMeasurement.export((await params).roomId, seasonId, dataset);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="season-${seasonId}-${dataset}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SuperadminAccessDeniedError
    )
      return Response.json(
        { error: "not_authorized" },
        {
          status: error instanceof AuthenticationRequiredError ? 401 : 403,
          headers: { "Cache-Control": "no-store" },
        },
      );
    return productError(error);
  }
}
