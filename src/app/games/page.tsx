import { GamesPage } from "@/components/GamesPage";
import { Nav } from "@/components/Nav";
import { fetchWorldCupStandings } from "@/lib/api-football";
import { createClient } from "@/lib/supabase/server";

export default async function GamesRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: matches }, { data: profile }, { data: picks }, groupBrackets] =
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
            .select("match_id, picked_winner")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
      fetchWorldCupStandings().catch(() => []),
    ]);

  const pickByMatchId = Object.fromEntries(
    (picks ?? []).map((p) => [p.match_id, p.picked_winner])
  );

  return (
    <>
      <Nav username={profile?.username} />
      <GamesPage
        matches={matches ?? []}
        groupBrackets={groupBrackets}
        pickByMatchId={pickByMatchId}
        isLoggedIn={!!user}
      />
    </>
  );
}
