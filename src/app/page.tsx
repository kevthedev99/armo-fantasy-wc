import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { NewsBar } from "@/components/NewsBar";
import { StandingsTable } from "@/components/StandingsTable";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);

  const [{ data: profiles }, { data: upcomingMatches }, { data: profile }] =
    await Promise.all([
      supabase.from("profiles").select("*").order("total_points", {
        ascending: false,
      }),
      supabase
        .from("matches")
        .select("*")
        .in("status", ["NS", "TBD"])
        .gte("kickoff_at", new Date().toISOString())
        .lte("kickoff_at", weekAhead.toISOString())
        .order("kickoff_at", { ascending: true })
        .limit(12),
      user
        ? supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single()
        : Promise.resolve({ data: null }),
    ]);

  return (
    <div className="min-h-screen bg-black">
      <Nav username={profile?.username} />
      <Hero />
      <NewsBar upcomingMatches={upcomingMatches ?? []} />
      <StandingsTable
        profiles={profiles ?? []}
        currentUserId={user?.id}
      />
    </div>
  );
}
