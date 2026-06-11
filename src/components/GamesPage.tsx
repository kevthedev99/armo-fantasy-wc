"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  formatPSTDateHeader,
  formatPSTTime,
  formatScore,
  getMatchBucket,
  getPSTDateKey,
  getStatusLabel,
} from "@/lib/match-status";
import type { Match, PickWinner } from "@/lib/types";

interface GamesPageProps {
  matches: Match[];
  pickByMatchId?: Record<number, PickWinner>;
  isLoggedIn?: boolean;
}

function PickMark() {
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0056b3] text-white"
      title="Your pick"
      aria-label="Your pick"
    >
      <svg
        viewBox="0 0 12 12"
        className="h-2.5 w-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2 6l3 3 5-5" />
      </svg>
    </span>
  );
}

function showHomePick(picked?: PickWinner): boolean {
  return picked === "home" || picked === "draw";
}

function showAwayPick(picked?: PickWinner): boolean {
  return picked === "away" || picked === "draw";
}

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  if (!src) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-8 w-8 shrink-0 object-contain" />
  );
}

function MatchRow({
  match,
  variant,
  pickedWinner,
}: {
  match: Match;
  variant: "live" | "upcoming" | "finished";
  pickedWinner?: PickWinner;
}) {
  const live = variant === "live";
  const finished = variant === "finished";
  const showScore = live || finished;

  return (
    <article
      className={`flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 ${
        live ? "bg-red-50/60" : "bg-white"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TeamLogo src={match.home_team_logo} name={match.home_team_name} />
        <span
          className={`min-w-0 flex-1 truncate text-sm font-semibold ${
            showScore &&
            match.home_score !== null &&
            match.away_score !== null &&
            match.home_score > match.away_score
              ? "text-black"
              : "text-gray-700"
          }`}
        >
          {match.home_team_name}
        </span>
        {showHomePick(pickedWinner) && <PickMark />}
      </div>

      <div className="flex w-20 shrink-0 flex-col items-center">
        {showScore ? (
          <span className="font-display text-xl tracking-wide text-black">
            {formatScore(match)}
          </span>
        ) : (
          <span className="text-sm font-bold text-[#0056b3]">
            {formatPSTTime(match.kickoff_at)}
          </span>
        )}
        <span
          className={`mt-0.5 text-[10px] font-bold uppercase tracking-wide ${
            live
              ? "text-red-600"
              : finished
                ? "text-gray-500"
                : "text-gray-400"
          }`}
        >
          {live && (
            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 align-middle" />
          )}
          {getStatusLabel(match.status)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2">
        <TeamLogo src={match.away_team_logo} name={match.away_team_name} />
        <span
          className={`min-w-0 flex-1 truncate text-right text-sm font-semibold ${
            showScore &&
            match.home_score !== null &&
            match.away_score !== null &&
            match.away_score > match.home_score
              ? "text-black"
              : "text-gray-700"
          }`}
        >
          {match.away_team_name}
        </span>
        {showAwayPick(pickedWinner) && <PickMark />}
      </div>
    </article>
  );
}

function MatchGroup({
  title,
  matches,
  variant,
  badge,
  pickByMatchId,
}: {
  title: string;
  matches: Match[];
  variant: "live" | "upcoming" | "finished";
  badge?: string;
  pickByMatchId: Record<number, PickWinner>;
}) {
  if (matches.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-700">
          {title}
        </h2>
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
              variant === "live"
                ? "bg-red-100 text-red-700"
                : "bg-gray-200 text-gray-600"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <div>
        {matches.map((match) => (
          <div key={match.id}>
            {(match.group_name || match.round) && (
              <p className="border-b border-gray-50 bg-white px-4 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                {match.group_name ?? match.round}
              </p>
            )}
            <MatchRow
              match={match}
              variant={variant}
              pickedWinner={pickByMatchId[match.id]}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

type GamesView = "future" | "past";

function ViewToggle({
  view,
  onChange,
}: {
  view: GamesView;
  onChange: (view: GamesView) => void;
}) {
  const options: { id: GamesView; label: string }[] = [
    { id: "future", label: "Future Games" },
    { id: "past", label: "Past Games" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ id, label }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              active
                ? "bg-[#0056b3] text-white shadow-sm"
                : "border border-gray-300 bg-white text-gray-600 hover:border-[#0056b3]/40 hover:text-[#0056b3]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function GamesPage({
  matches,
  pickByMatchId = {},
  isLoggedIn = false,
}: GamesPageProps) {
  const router = useRouter();
  const [view, setView] = useState<GamesView>("future");

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(interval);
  }, [router]);

  const { live, upcomingByDate, finishedByDate } = useMemo(() => {
    const now = new Date();
    const liveList: Match[] = [];
    const upcomingList: Match[] = [];
    const finishedList: Match[] = [];

    for (const match of matches) {
      const bucket = getMatchBucket(match, now);
      if (bucket === "live") liveList.push(match);
      else if (bucket === "upcoming") upcomingList.push(match);
      else finishedList.push(match);
    }

    liveList.sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    );
    upcomingList.sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    );
    finishedList.sort(
      (a, b) =>
        new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime()
    );

    const upcomingByDate = new Map<string, Match[]>();
    for (const match of upcomingList) {
      const key = getPSTDateKey(match.kickoff_at);
      const list = upcomingByDate.get(key) ?? [];
      list.push(match);
      upcomingByDate.set(key, list);
    }

    const finishedByDate = new Map<string, Match[]>();
    for (const match of finishedList) {
      const key = getPSTDateKey(match.kickoff_at);
      const list = finishedByDate.get(key) ?? [];
      list.push(match);
      finishedByDate.set(key, list);
    }

    return { live: liveList, upcomingByDate, finishedByDate };
  }, [matches]);

  const upcomingDates = [...upcomingByDate.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const finishedDates = [...finishedByDate.entries()].sort(([a], [b]) =>
    b.localeCompare(a)
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#0056b3] px-4 py-8 text-white md:px-8">
        <h1 className="text-4xl font-black uppercase tracking-tight md:text-5xl">
          Games
        </h1>
        <p className="mt-2 text-sm text-white/80">
          Live scores and upcoming kickoffs — all times Pacific.
        </p>
      </header>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 md:px-8">
        {isLoggedIn && (
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <PickMark />
            <span>
              Blue checkmark = the team you picked to win. Draw picks show on
              both teams.
            </span>
          </p>
        )}

        <MatchGroup
          title="Live Now"
          matches={live}
          variant="live"
          badge={live.length > 0 ? `${live.length} live` : undefined}
          pickByMatchId={pickByMatchId}
        />

        <ViewToggle view={view} onChange={setView} />

        {live.length === 0 &&
          upcomingDates.length === 0 &&
          finishedDates.length === 0 && (
            <p className="py-16 text-center text-gray-500">
              No matches loaded yet. Scores update when the daily sync runs.
            </p>
          )}

        {view === "future" && (
          <>
            {live.length === 0 && upcomingDates.length > 0 && (
              <p className="text-center text-xs text-gray-500">
                No live matches right now.
              </p>
            )}

            {upcomingDates.length === 0 && live.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">
                No upcoming matches scheduled.
              </p>
            )}

            {upcomingDates.map(([dateKey, dayMatches]) => (
              <MatchGroup
                key={dateKey}
                title={formatPSTDateHeader(dayMatches[0].kickoff_at)}
                matches={dayMatches}
                variant="upcoming"
                badge={`${dayMatches.length} match${dayMatches.length !== 1 ? "es" : ""}`}
                pickByMatchId={pickByMatchId}
              />
            ))}
          </>
        )}

        {view === "past" && (
          <>
            {finishedDates.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">
                No past results yet.
              </p>
            )}

            {finishedDates.map(([dateKey, dayMatches]) => (
              <MatchGroup
                key={dateKey}
                title={formatPSTDateHeader(dayMatches[0].kickoff_at)}
                matches={dayMatches}
                variant="finished"
                badge={`${dayMatches.length} match${dayMatches.length !== 1 ? "es" : ""}`}
                pickByMatchId={pickByMatchId}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
