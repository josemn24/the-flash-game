import { NextResponse } from "next/server";
import { runCalendarTick } from "@/server/admin-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasValidSecret(request: Request) {
  const secret = process.env.CALENDAR_TICK_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!process.env.CALENDAR_TICK_SECRET) {
    return NextResponse.json({ error: "calendar_tick_unavailable" }, { status: 503 });
  }
  if (!hasValidSecret(request)) {
    return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  }
  try {
    const result = await runCalendarTick();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "calendar_tick_failed";
    return NextResponse.json({ error: code }, { status: code === "calendar_tick_unauthorized" ? 401 : 500 });
  }
}
