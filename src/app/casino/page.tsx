import { Nav } from "@/components/Nav";
import { RoulettePage } from "@/components/RoulettePage";
import { loadCasinoPageData } from "@/lib/casino-page-data";

export default async function CasinoPage() {
  const { profile, initialBalance, userId, leaderboard } =
    await loadCasinoPageData();

  return (
    <div className="min-h-screen bg-black">
      <Nav username={profile?.username} />
      <div className="border-b border-[#FFD700]/20 bg-gradient-to-b from-[#0d2818]/40 to-black">
        <RoulettePage
          initialBalance={initialBalance}
          initialLeaderboard={leaderboard}
          currentUserId={userId}
        />
      </div>
    </div>
  );
}
