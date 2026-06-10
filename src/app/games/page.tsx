import { GamesPage } from "@/components/GamesPage";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

export default async function GamesRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: matches }, { data: profile }] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff_at", { ascending: true }),
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
      <GamesPage matches={matches ?? []} />
    </>
  );
}
