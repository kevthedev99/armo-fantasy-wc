import { NextResponse } from "next/server";
import {
  fetchWorldCupFixtures,
  parseGroupName,
  parseStage,
} from "@/lib/api-football";
import { isMatchFinished, scorePick } from "@/lib/scoring";
import { createServiceClient } from "@/lib/supabase/server";

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const fixtures = await fetchWorldCupFixtures();

  let groupFinishedCount = 0;
  let groupTotal = 0;

  for (const f of fixtures) {
    const stage = parseStage(f.league.round);
    if (stage === "group") groupTotal++;

    const homeScore = f.goals.home ?? f.score.fulltime.home;
    const awayScore = f.goals.away ?? f.score.fulltime.away;
    const finished = isMatchFinished(f.fixture.status.short);

    if (stage === "group" && finished) groupFinishedCount++;

    await supabase.from("matches").upsert(
      {
        id: f.fixture.id,
        round: f.league.round,
        group_name: parseGroupName(f.league.round),
        stage,
        home_team_id: f.teams.home.id,
        home_team_name: f.teams.home.name,
        home_team_logo: f.teams.home.logo,
        away_team_id: f.teams.away.id,
        away_team_name: f.teams.away.name,
        away_team_logo: f.teams.away.logo,
        kickoff_at: f.fixture.date,
        status: f.fixture.status.short,
        home_score: homeScore,
        away_score: awayScore,
        winning_goal_minute: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  }

  const groupComplete =
    groupTotal > 0 && groupFinishedCount === groupTotal;

  await supabase
    .from("app_settings")
    .update({
      knockout_unlocked: groupComplete,
      group_stage_complete: groupComplete,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  // Score finished matches
  const { data: finishedMatches } = await supabase
    .from("matches")
    .select("*")
    .in("status", ["FT", "AET", "PEN"]);

  for (const match of finishedMatches ?? []) {
    const { data: unscoredPicks } = await supabase
      .from("picks")
      .select("*")
      .eq("match_id", match.id)
      .eq("is_scored", false);

    for (const pick of unscoredPicks ?? []) {
      const points = scorePick(match, pick);
      const won = points > 0;

      await supabase
        .from("picks")
        .update({ points_earned: points, is_scored: true })
        .eq("id", pick.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("total_points, total_wins, current_streak")
        .eq("id", pick.user_id)
        .single();

      if (profile) {
        await supabase
          .from("profiles")
          .update({
            total_points: profile.total_points + points,
            total_wins: profile.total_wins + (won ? 1 : 0),
            current_streak: won ? profile.current_streak + 1 : 0,
          })
          .eq("id", pick.user_id);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    synced: fixtures.length,
    groupComplete,
  });
}
