import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { UserPicksView } from "@/components/UserPicksView";
import { fetchBracketSlotPicksForUser } from "@/lib/bracket-slot-pick-db";
import { isKnockoutBracketOpen } from "@/lib/knockout-bracket";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { normalizeUsername } from "@/lib/username";

interface PlayerPageProps {
  params: Promise<{ username: string }>;
}

function getRank(profiles: Profile[], userId: string): number {
  const sorted = [...profiles].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    return b.total_wins - a.total_wins;
  });
  return sorted.findIndex((p) => p.id === userId) + 1;
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { username } = await params;
  const cleanUsername = normalizeUsername(username);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: playerProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", cleanUsername)
    .single();

  if (!playerProfile) {
    notFound();
  }

  const [
    { data: allProfiles },
    { data: picks },
    { data: matches },
    { data: currentProfile },
    slotPickResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("picks").select("*").eq("user_id", playerProfile.id),
    supabase.from("matches").select("*").order("kickoff_at", { ascending: true }),
    user
      ? supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single()
      : Promise.resolve({ data: null }),
    fetchBracketSlotPicksForUser(supabase, playerProfile.id),
  ]);

  const rank = getRank(allProfiles ?? [], playerProfile.id);

  return (
    <>
      <Nav username={currentProfile?.username} />
      <div className="border-b border-gray-800 bg-black px-4 py-2 md:px-8">
        <Link
          href="/#standings"
          className="text-xs font-bold uppercase tracking-wide text-gray-400 hover:text-[#FF007A]"
        >
          ← Back to Standings
        </Link>
      </div>
      <UserPicksView
        profile={playerProfile}
        rank={rank}
        picks={picks ?? []}
        slotPicks={slotPickResult.picks}
        matches={matches ?? []}
        knockoutUnlocked={isKnockoutBracketOpen(matches ?? [])}
        isCurrentUser={user?.id === playerProfile.id}
      />
    </>
  );
}
