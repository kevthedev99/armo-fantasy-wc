import { NextResponse } from "next/server";
import { fetchMatchPickDistribution } from "@/lib/match-pick-distribution";
import { verifyMatchShareToken } from "@/lib/match-share-token";
import { createServiceClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ matchId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { matchId: matchIdRaw } = await params;
  const matchId = Number(matchIdRaw);
  if (!Number.isFinite(matchId)) {
    return NextResponse.json({ error: "Invalid match id." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!verifyMatchShareToken(matchId, token)) {
    return NextResponse.json({ error: "Invalid or missing token." }, { status: 403 });
  }

  const supabase = createServiceClient();
  const distribution = await fetchMatchPickDistribution(supabase, matchId);
  if (!distribution) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  return NextResponse.json(distribution);
}
