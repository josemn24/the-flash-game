import { describe, expectTypeOf, it } from "vitest";
import type { PublicFunctionArgs, PublicFunctionRow } from "./rpcTypes";

describe("generated Supabase RPC types", () => {
  it("derives argument contracts from public functions", () => {
    expectTypeOf<PublicFunctionArgs<"get_room_detail">>().toEqualTypeOf<{
      target_room_slug: string;
    }>();
    expectTypeOf<PublicFunctionArgs<"get_challenge_ranking">>().toEqualTypeOf<{
      target_publication_id: string;
    }>();
  });

  it("extracts rows only from structured array-returning functions", () => {
    expectTypeOf<PublicFunctionRow<"get_my_room_cards">>().toEqualTypeOf<
      PublicFunctionRow<"get_room_detail">
    >();
    expectTypeOf<PublicFunctionRow<"get_challenge_ranking">>().toMatchTypeOf<{
      player_id: string;
      display_name: string;
      flash_points: number;
    }>();
    expectTypeOf<PublicFunctionRow<"get_superadmin_portal_context">>().toBeNever();
  });
});
