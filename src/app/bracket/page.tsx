import { Nav } from "@/components/Nav";
import { KnockoutBracketView } from "@/components/KnockoutBracketView";
import { fetchBracketSlotPicksForUser } from "@/lib/bracket-slot-pick-db";
import { createClient } from "@/lib/supabase/server";

export default async function BracketRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: matches },
    { data: picks },
    { data: profile },
    { data: settings },
    slotPickResult,
  ] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff_at", { ascending: true }),
    user
      ? supabase.from("picks").select("*").eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
    user
      ? supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("app_settings")
      .select("knockout_unlocked, group_stage_complete")
      .eq("id", 1)
      .single(),
    user
      ? fetchBracketSlotPicksForUser(supabase, user.id)
      : Promise.resolve({ picks: [], tableMissing: false }),
  ]);

  return (
    <>
      <Nav username={profile?.username} />
      <KnockoutBracketView
        key={user?.id ?? "guest"}
        userId={user?.id ?? null}
        matches={matches ?? []}
        picks={picks ?? []}
        initialSlotPicks={slotPickResult.picks}
        slotPicksTableMissing={slotPickResult.tableMissing}
        challengeSettings={settings}
      />
    </>
  );
}
