import { Nav } from "@/components/Nav";
import { PicksPage } from "@/components/PicksPage";
import { createClient } from "@/lib/supabase/server";

export default async function PicksRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: matches },
    { data: picks },
    { data: settings },
    { data: profile },
  ] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff_at", { ascending: true }),
    user
      ? supabase.from("picks").select("*").eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
    supabase.from("app_settings").select("*").eq("id", 1).single(),
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
      <PicksPage
        matches={matches ?? []}
        picks={picks ?? []}
        settings={
          settings ?? {
            knockout_unlocked: false,
            group_stage_complete: false,
            last_sync_at: null,
          }
        }
      />
    </>
  );
}
