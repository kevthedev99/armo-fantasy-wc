import { GamesPage } from "@/components/GamesPage";
import { Nav } from "@/components/Nav";
import { buildPickDetailsByMatchId, fetchAllPicksWithProfiles } from "@/lib/match-pick-details";
import { createClient } from "@/lib/supabase/server";
import type { Pick } from "@/lib/types";

export default async function GamesRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: matches }, { data: profile }, { data: picks }, allPicks] =
    await Promise.all([
      supabase.from("matches").select("*").order("kickoff_at", { ascending: true }),
      user
        ? supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single()
        : Promise.resolve({ data: null }),
      user
        ? supabase
            .from("picks")
            .select("match_id, picked_winner, home_score_pred, away_score_pred, predicts_penalties, winning_goal_minute_pred")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
      fetchAllPicksWithProfiles(supabase).catch((err) => {
        console.error("Games pick details fetch failed:", err);
        return [];
      }),
    ]);

  const pickByMatchId = Object.fromEntries(
    (picks ?? []).map((p) => [p.match_id, p.picked_winner])
  );

  const userPicks = (picks ?? []) as Pick[];

  const pickDetailsByMatchId = buildPickDetailsByMatchId(
    matches ?? [],
    allPicks ?? []
  );

  return (
    <>
      <Nav username={profile?.username} />
      <GamesPage
        matches={matches ?? []}
        pickByMatchId={pickByMatchId}
        userPicks={userPicks}
        pickDetailsByMatchId={pickDetailsByMatchId}
        isLoggedIn={!!user}
      />
    </>
  );
}
