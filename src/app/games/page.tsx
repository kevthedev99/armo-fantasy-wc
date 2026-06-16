import { GamesPage } from "@/components/GamesPage";
import { Nav } from "@/components/Nav";
import { fetchWorldCupStandings } from "@/lib/api-football";
import { buildPickDetailsByMatchId, fetchAllPicksWithProfiles } from "@/lib/match-pick-details";
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
    allPicks,
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
    fetchAllPicksWithProfiles(supabase).catch((err) => {
      console.error("Games pick details fetch failed:", err);
      return [];
    }),
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
