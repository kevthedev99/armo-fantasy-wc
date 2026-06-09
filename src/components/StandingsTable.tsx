import type { Profile } from "@/lib/types";

interface StandingsTableProps {
  profiles: Profile[];
  currentUserId?: string;
}

export function StandingsTable({ profiles, currentUserId }: StandingsTableProps) {
  const sorted = [...profiles].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    return b.total_wins - a.total_wins;
  });

  const lastPlaceId = sorted.length > 1 ? sorted[sorted.length - 1]?.id : null;

  return (
    <section id="standings" className="bg-black px-4 py-12 md:px-8">
      <h2 className="text-4xl font-black uppercase tracking-tight text-white md:text-5xl">
        Standings
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Armo Fantasy World Cup League
      </p>

      <div className="mt-8 overflow-hidden rounded-lg border border-gray-800">
        <div className="grid grid-cols-[48px_1fr_72px_80px_72px] bg-[#0a1628] px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400 md:grid-cols-[56px_1fr_100px_100px_100px]">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Wins</span>
          <span className="text-right">Points</span>
          <span className="text-right">Streak</span>
        </div>

        {sorted.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-500">
            No players yet. Be the first to sign up!
          </p>
        ) : (
          sorted.map((profile, index) => {
            const isFirst = index === 0;
            const isLast = profile.id === lastPlaceId && sorted.length > 3;
            const isYou = profile.id === currentUserId;

            return (
              <div
                key={profile.id}
                className={`grid grid-cols-[48px_1fr_72px_80px_72px] items-center border-t border-gray-800 px-4 py-3 md:grid-cols-[56px_1fr_100px_100px_100px] ${
                  index % 2 === 0 ? "bg-[#111]" : "bg-[#1a1a1a]"
                } ${isFirst ? "border-l-4 border-l-[#FF007A]" : ""}`}
              >
                <span className="font-bold text-[#FFD700]">{index + 1}</span>
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: profile.avatar_color }}
                  >
                    {profile.display_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate font-medium text-white">
                    {profile.display_name}
                    {isYou && (
                      <span className="ml-2 text-xs text-[#32CD32]">(you)</span>
                    )}
                  </span>
                  {isLast && (
                    <span className="shrink-0 rounded bg-amber-900 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                      Wooden Spoon
                    </span>
                  )}
                </div>
                <span className="text-right text-white">{profile.total_wins}</span>
                <span className="text-right font-bold text-white">
                  {profile.total_points}
                </span>
                <span className="text-right text-gray-400">
                  {profile.current_streak > 0 ? profile.current_streak : "—"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
