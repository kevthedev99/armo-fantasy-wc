import { NextResponse } from "next/server";
import { fetchWorldCupStandings } from "@/lib/api-football";

export async function GET() {
  try {
    const groups = await fetchWorldCupStandings();
    return NextResponse.json({ groups });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message, groups: [] }, { status: 500 });
  }
}
