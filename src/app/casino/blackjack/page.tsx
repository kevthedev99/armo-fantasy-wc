import { BlackjackPage } from "@/components/BlackjackPage";
import { Nav } from "@/components/Nav";
import { loadBlackjackPageData } from "@/lib/casino-page-data";

export default async function BlackjackRoutePage() {
  const { profile, initialBalance, initialView, userId, leaderboard } =
    await loadBlackjackPageData();

  return (
    <div className="min-h-screen bg-black">
      <Nav username={profile?.username} />
      <div className="border-b border-[#FFD700]/20 bg-gradient-to-b from-[#0d2818]/40 to-black">
        <BlackjackPage
          initialBalance={initialBalance}
          initialView={initialView}
          initialLeaderboard={leaderboard}
          currentUserId={userId}
        />
      </div>
    </div>
  );
}
