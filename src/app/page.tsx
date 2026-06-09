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

  const [{ data: profiles }, { data: news }, { data: profile }] =
    await Promise.all([
      supabase.from("profiles").select("*").order("total_points", {
        ascending: false,
      }),
      supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
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
      <NewsBar items={news ?? []} />
      <StandingsTable
        profiles={profiles ?? []}
        currentUserId={user?.id}
      />
    </div>
  );
}
