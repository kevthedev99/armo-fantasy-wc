import { Nav } from "@/components/Nav";
import { PicksPage } from "@/components/PicksPage";
import { isKnockoutChallengeActive } from "@/lib/knockout-bracket";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PicksRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: matches }, { data: picks }, { data: profile }, { data: settings }] =
    await Promise.all([
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
    ]);

  if (isKnockoutChallengeActive(matches ?? [], settings)) {
    redirect("/bracket");
  }

  return (
    <>
      <Nav username={profile?.username} />
      <PicksPage matches={matches ?? []} picks={picks ?? []} />
    </>
  );
}
