import { NextResponse } from "next/server";
import { runCalendarTick } from "@/server/admin-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasValidSecret(request: Request, secretName: "CALENDAR_TICK_SECRET" | "CRON_SECRET") {
  const secret = process.env[secretName];
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handleTick(request: Request, secretName: "CALENDAR_TICK_SECRET" | "CRON_SECRET") {
  if (!process.env[secretName]) {
    return NextResponse.json({ error: "calendar_tick_unavailable" }, { status: 503 });
  }
  if (!hasValidSecret(request, secretName)) {
    return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  }
  try {
    const result = await runCalendarTick();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "calendar_tick_failed";
    return NextResponse.json(
      { error: code },
      { status: code === "calendar_tick_unauthorized" ? 401 : 500 },
    );
  }
}

export function GET(request: Request) {
  return handleTick(request, "CRON_SECRET");
}

export function POST(request: Request) {
  return handleTick(request, "CALENDAR_TICK_SECRET");
}
