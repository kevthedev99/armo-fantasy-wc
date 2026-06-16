import { GamesPage } from "@/components/GamesPage";
import { Nav } from "@/components/Nav";
import { fetchWorldCupStandings } from "@/lib/api-football";
import { buildPickDetailsByMatchId } from "@/lib/match-pick-details";
import { createClient } from "@/lib/supabase/server";

export default async function GamesRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: matches },
    { data: profile },
    { data: picks },
    { data: allPicks },
    groupBrackets,
  ] = await Promise.all([
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
          .select("match_id, picked_winner")
          .eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
    supabase.from("picks").select(
      "match_id, picked_winner, home_score_pred, away_score_pred, profiles!inner(display_name, username)"
    ),
    fetchWorldCupStandings().catch((err) => {
      console.error("Group standings prefetch failed:", err);
      return [];
    }),
  ]);

  const pickByMatchId = Object.fromEntries(
    (picks ?? []).map((p) => [p.match_id, p.picked_winner])
  );

  const pickDetailsByMatchId = buildPickDetailsByMatchId(
    matches ?? [],
    allPicks ?? []
  );

  return (
    <>
      <Nav username={profile?.username} />
      <GamesPage
        matches={matches ?? []}
        groupBrackets={groupBrackets}
        pickByMatchId={pickByMatchId}
        pickDetailsByMatchId={pickDetailsByMatchId}
        isLoggedIn={!!user}
      />
    </>
  );
}
