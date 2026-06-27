import { Nav } from "@/components/Nav";
import { KnockoutBracketView } from "@/components/KnockoutBracketView";
import { migrateBracketSlotPicks } from "@/lib/migrate-bracket-slot-picks";
import { createClient } from "@/lib/supabase/server";

export default async function BracketRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff_at", { ascending: true });

  if (user && matches?.length) {
    await migrateBracketSlotPicks(supabase, user.id, matches);
  }

  const [{ data: picks }, { data: slotPicks }, { data: profile }] =
    await Promise.all([
      user
        ? supabase.from("picks").select("*").eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
      user
        ? supabase
            .from("bracket_slot_picks")
            .select("*")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
      user
        ? supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single()
        : Promise.resolve({ data: null }),
    ]);

  return (
    <>
      <Nav username={profile?.username} />
      <KnockoutBracketView
        matches={matches ?? []}
        picks={picks ?? []}
        slotPicks={slotPicks ?? []}
      />
    </>
  );
}
