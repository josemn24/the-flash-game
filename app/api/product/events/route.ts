import { productMeasurement } from "@/server/product/measurement";
import { productBody, productError } from "@/server/product/http";
import { parseEvent } from "@/lib/measurement/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await productMeasurement.capture(parseEvent(await productBody(request)));
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return productError(error);
  }
}
