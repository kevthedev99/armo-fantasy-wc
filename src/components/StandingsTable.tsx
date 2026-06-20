import Link from "next/link";
import { RankChangeBadge } from "@/components/RankChangeBadge";
import { SponsorBanner } from "@/components/SponsorBanner";
import { WorldCupLogo } from "@/components/WorldCupLogo";
import { formatStreak } from "@/lib/scoring";
import { sortProfiles } from "@/lib/standings";
import type { Profile } from "@/lib/types";

interface StandingsTableProps {
  profiles: Profile[];
  currentUserId?: string;
}

function PlayerAvatar({ profile }: { profile: Profile }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white md:h-8 md:w-8 md:text-xs"
      style={{ backgroundColor: profile.avatar_color }}
    >
      {profile.display_name.charAt(0).toUpperCase()}
    </span>
  );
}

const PODIUM_POT_SHARE: Record<1 | 2 | 3, string> = {
  1: "80% of Pot",
  2: "15% of Pot",
  3: "5% of Pot",
};

function PotShareBadge({ rank }: { rank: 1 | 2 | 3 }) {
  return (
    <span className="inline-block rounded bg-[#0d3d1a] px-2 py-0.5 text-[10px] font-bold uppercase text-[#32CD32]">
      {PODIUM_POT_SHARE[rank]}
    </span>
  );
}

function PodiumBadge({ rank }: { rank: 1 | 2 | 3 }) {
  if (rank === 1) {
    return (
      <span className="inline-block rounded bg-[#3d3200] px-2 py-0.5 text-[10px] font-bold uppercase text-[#FFD700]">
        👑 Champion
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-block rounded bg-gray-700 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-200">
        🥈 Silver
      </span>
    );
  }
  return (
    <span className="inline-block rounded bg-[#5c3d1e] px-2 py-0.5 text-[10px] font-bold uppercase text-[#cd7f32]">
      🥉 Bronze
    </span>
  );
}

function LastPlaceBadge() {
  return (
    <span className="inline-block rounded bg-amber-900 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-200">
      Last Place
    </span>
  );
}

function podiumRank(index: number): 1 | 2 | 3 | null {
  if (index === 0) return 1;
  if (index === 1) return 2;
  if (index === 2) return 3;
  return null;
}

export function StandingsTable({ profiles, currentUserId }: StandingsTableProps) {
  const sorted = sortProfiles(profiles);
  const lastPlaceId = sorted.length > 1 ? sorted[sorted.length - 1]?.id : null;

  return (
    <section id="standings" className="bg-black px-4 py-12 md:px-8">
      <div className="flex items-center gap-4 md:gap-5">
        <WorldCupLogo className="hidden h-16 w-auto shrink-0 object-contain sm:block md:h-20" />
        <div>
          <div className="flex items-center gap-3 sm:gap-0">
            <WorldCupLogo className="h-12 w-auto shrink-0 object-contain sm:hidden" />
            <h2 className="text-4xl font-black uppercase tracking-tight text-white md:text-5xl">
              Standings
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Armo Fantasy World Cup League · Tap a player to view their picks
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-8 rounded-lg border border-gray-800 px-4 py-8 text-center text-gray-500">
          No players yet. Be the first to sign up!
        </p>
      ) : (
        <>
          {/* Mobile: card layout */}
          <div className="mt-6 space-y-3 md:hidden">
            {sorted.map((profile, index) => {
              const isFirst = index === 0;
              const rank = podiumRank(index);
              const isLast = profile.id === lastPlaceId && sorted.length > 3;
              const isYou = profile.id === currentUserId;

              return (
                <Link
                  key={profile.id}
                  href={`/player/${profile.username}`}
                  className={`block rounded-xl border border-gray-800 p-4 transition active:scale-[0.98] ${
                    isFirst
                      ? "border-l-4 border-l-[#FF007A] bg-[#111]"
                      : "bg-[#111] hover:bg-[#1a1a1a]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 w-6 shrink-0 text-lg font-black text-[#FFD700]">
                      {index + 1}
                    </span>
                    <PlayerAvatar profile={profile} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-base font-bold leading-snug text-white">
                        {profile.display_name}
                        <RankChangeBadge
                          change={profile.rank_change ?? 0}
                          className="ml-1.5 align-middle"
                        />
                        {isYou && (
                          <span className="ml-1.5 text-xs font-normal text-[#32CD32]">
                            (you)
                          </span>
                        )}
                      </p>
                      {(rank || isLast) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {rank && (
                            <>
                              <PodiumBadge rank={rank} />
                              <PotShareBadge rank={rank} />
                            </>
                          )}
                          {isLast && <LastPlaceBadge />}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="text-gray-400">
                          <span className="font-bold text-white">
                            {profile.total_points}
                          </span>{" "}
                          pts
                        </span>
                        <span className="text-gray-400">
                          <span className="font-bold text-white">
                            {profile.total_wins}
                          </span>{" "}
                          wins
                        </span>
                        <span className="text-gray-400">
                          Streak{" "}
                          <span className="font-bold text-white">
                            {formatStreak(profile.current_streak)}
                          </span>
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-gray-600" aria-hidden>
                      ›
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop: table layout */}
          <div className="mt-8 hidden overflow-hidden rounded-lg border border-gray-800 md:block">
            <div className="grid grid-cols-[56px_1fr_100px_100px_100px] bg-[#0a1628] px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Points</span>
              <span className="text-right">Wins</span>
              <span className="text-right">Streak</span>
            </div>

            {sorted.map((profile, index) => {
              const isFirst = index === 0;
              const rank = podiumRank(index);
              const isLast = profile.id === lastPlaceId && sorted.length > 3;
              const isYou = profile.id === currentUserId;

              return (
                <Link
                  key={profile.id}
                  href={`/player/${profile.username}`}
                  className={`grid grid-cols-[56px_1fr_100px_100px_100px] items-center border-t border-gray-800 px-4 py-3 transition hover:bg-[#222] ${
                    index % 2 === 0 ? "bg-[#111]" : "bg-[#1a1a1a]"
                  } ${isFirst ? "border-l-4 border-l-[#FF007A]" : ""}`}
                >
                  <span className="font-bold text-[#FFD700]">{index + 1}</span>
                  <div className="flex min-w-0 items-center gap-3">
                    <PlayerAvatar profile={profile} />
                    <span className="truncate font-medium text-white hover:text-[#FF007A]">
                      {profile.display_name}
                      <RankChangeBadge
                        change={profile.rank_change ?? 0}
                        className="ml-2 align-middle"
                      />
                      {isYou && (
                        <span className="ml-2 text-xs text-[#32CD32]">
                          (you)
                        </span>
                      )}
                    </span>
                    {rank && (
                      <>
                        <span className="shrink-0">
                          <PodiumBadge rank={rank} />
                        </span>
                        <span className="shrink-0">
                          <PotShareBadge rank={rank} />
                        </span>
                      </>
                    )}
                    {isLast && (
                      <span className="shrink-0">
                        <LastPlaceBadge />
                      </span>
                    )}
                  </div>
                  <span className="text-right font-bold text-white">
                    {profile.total_points}
                  </span>
                  <span className="text-right text-white">
                    {profile.total_wins}
                  </span>
                  <span className="text-right text-gray-400">
                    {formatStreak(profile.current_streak)}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <SponsorBanner variant="standings" />
    </section>
  );
}
