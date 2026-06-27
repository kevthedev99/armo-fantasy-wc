import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { fetchWorldCupStandings } from "@/lib/api-football";

const getCachedStandings = unstable_cache(
  async () => fetchWorldCupStandings(),
  ["world-cup-group-standings"],
  { revalidate: 30 * 60 }
);

export async function GET() {
  try {
    const groups = await getCachedStandings();
    return NextResponse.json({ groups });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message, groups: [] }, { status: 500 });
  }
}
