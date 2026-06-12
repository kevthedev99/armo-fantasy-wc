"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CasinoLeaderboardRow } from "@/lib/casino-types";

interface CasinoLeaderboardProps {
  initialLeaders?: CasinoLeaderboardRow[];
  currentUserId?: string | null;
}

function PlayerAvatar({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function CasinoLeaderboard({
  initialLeaders = [],
  currentUserId,
}: CasinoLeaderboardProps) {
  const [leaders, setLeaders] = useState(initialLeaders);
  const [loading, setLoading] = useState(initialLeaders.length === 0);

  const loadLeaderboard = useCallback(async () => {
    const res = await fetch("/api/casino/leaderboard");
    const data = await res.json();
    if (res.ok && Array.isArray(data.leaders)) {
      setLeaders(data.leaders);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadLeaderboard();
    }, 60_000);
    return () => clearInterval(interval);
  }, [loadLeaderboard]);

  return (
    <section className="mt-10 rounded-xl border border-[#FFD700]/20 bg-white/[0.03] p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#FFD700]">
            Side Lounge
          </p>
          <h2 className="font-display text-2xl tracking-wide text-white sm:text-3xl">
            CHIP LEADERBOARD
          </h2>
        </div>
        <p className="text-xs text-gray-500">Top 10 balances · Roulette & Blackjack</p>
      </div>

      {loading && leaders.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Loading leaderboard…</p>
      ) : leaders.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No chip balances yet. Be the first to stack up!
        </p>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {leaders.map((row) => {
              const isYou = row.userId === currentUserId;
              return (
                <Link
                  key={row.userId}
                  href={`/player/${row.username}`}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-3 transition hover:bg-white/[0.04] ${
                    isYou
                      ? "border-[#32CD32]/40 bg-[#32CD32]/5"
                      : "border-white/10 bg-black/20"
                  }`}
                >
                  <span
                    className={`w-6 shrink-0 text-center text-sm font-black ${
                      row.rank <= 3 ? "text-[#FFD700]" : "text-gray-400"
                    }`}
                  >
                    {row.rank}
                  </span>
                  <PlayerAvatar
                    name={row.displayName}
                    color={row.avatarColor}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">
                      {row.displayName}
                      {isYou && (
                        <span className="ml-1 text-[10px] font-normal text-[#32CD32]">
                          (you)
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-[#FFD700]">
                    ${row.balance.toLocaleString()}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-white/10 md:block">
            <div className="grid grid-cols-[56px_1fr_120px] bg-[#0a1628] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Chips</span>
            </div>
            {leaders.map((row, index) => {
              const isYou = row.userId === currentUserId;
              return (
                <Link
                  key={row.userId}
                  href={`/player/${row.username}`}
                  className={`grid grid-cols-[56px_1fr_120px] items-center border-t border-white/10 px-4 py-3 transition hover:bg-white/[0.04] ${
                    index % 2 === 0 ? "bg-black/20" : "bg-black/10"
                  }`}
                >
                  <span
                    className={`font-bold ${
                      row.rank <= 3 ? "text-[#FFD700]" : "text-gray-400"
                    }`}
                  >
                    {row.rank}
                  </span>
                  <div className="flex min-w-0 items-center gap-3">
                    <PlayerAvatar
                      name={row.displayName}
                      color={row.avatarColor}
                    />
                    <span className="truncate font-medium text-white">
                      {row.displayName}
                      {isYou && (
                        <span className="ml-2 text-xs text-[#32CD32]">(you)</span>
                      )}
                    </span>
                  </div>
                  <span className="text-right font-black text-[#FFD700]">
                    ${row.balance.toLocaleString()}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
