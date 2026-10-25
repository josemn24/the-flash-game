import "server-only";
import { createClient } from "@/infrastructure/supabase/auth/server-client";
import type { ProductMeasurementGateway } from "@/application/ports/product-measurement";
import type { Json } from "@/infrastructure/supabase/database.types";
import { parseRating } from "@/lib/measurement/validation";
import type { PublicFunctionName, PublicFunctionArgs } from "@/infrastructure/supabase/rpcTypes";
async function rpc(name: PublicFunctionName, args: Record<string, unknown>) {
  const client = await createClient();
  const { data, error } = await client.rpc(name, args as PublicFunctionArgs<typeof name>);
  if (error) {
    if (error.code === "42501") throw new Error("not_authorized");
    throw new Error(
      error.message.includes("measurement_rate_limited")
        ? "measurement_rate_limited"
        : error.message,
    );
  }
  return data as unknown;
}
export const supabaseProductMeasurement: ProductMeasurementGateway = {
  async capture(input) {
    // A false RPC result is an intentional scope/quota drop, not a gameplay failure.
    await rpc("record_room_measurement_event", { input: input as unknown as Json });
  },
  async rating(publicationId) {
    return parseRating(await rpc("get_my_season_rating", { target_publication_id: publicationId }));
  },
  async rate(input) {
    return parseRating(await rpc("save_my_season_rating", { input: input as unknown as Json }));
  },
};
