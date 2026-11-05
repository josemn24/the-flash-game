import { NextResponse } from "next/server";
import { productMeasurement } from "@/server/product/measurement";
import { productBody, productError } from "@/server/product/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ publicationId: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    return NextResponse.json(await productMeasurement.rating((await params).publicationId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return productError(error);
  }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    const body = await productBody(request);
    if (
      typeof body.value !== "number" ||
      Object.keys(body).some((k) => !["id", "value", "seasonId"].includes(k))
    )
      throw new Error("invalid_rating");
    return NextResponse.json(
      await productMeasurement.rate({
        id: String(body.id),
        value: body.value,
        seasonId: String(body.seasonId ?? ""),
        publicationId: (await params).publicationId,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return productError(error);
  }
}
