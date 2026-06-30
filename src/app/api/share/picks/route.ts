import { NextResponse } from "next/server";
import { fetchAllMatchPickDistributions } from "@/lib/match-pick-distribution";
import { verifyPicksShareToken } from "@/lib/match-share-token";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!verifyPicksShareToken(token)) {
    return NextResponse.json({ error: "Invalid or missing token." }, { status: 403 });
  }

  const supabase = createServiceClient();
  const distributions = await fetchAllMatchPickDistributions(supabase);

  return NextResponse.json({ matches: distributions });
}
