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
import {
  formatEventMinute,
  goalsForSide,
  redCardsForSide,
} from "@/lib/match-events";
import { GroupBrackets } from "@/components/GroupBrackets";
import type { GroupBracket, Match, MatchEvent, PickWinner } from "@/lib/types";

interface GamesPageProps {
  matches: Match[];
  groupBrackets?: GroupBracket[];
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

function TeamSide({
  name,
  logo,
  emphasized,
  showPick,
  mobileAlign = "left",
}: {
  name: string;
  logo: string | null;
  emphasized: boolean;
  showPick: boolean;
  mobileAlign?: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        mobileAlign === "right" ? "md:flex-row-reverse" : ""
      }`}
    >
      <TeamLogo src={logo} name={name} />
      <span
        className={`min-w-0 flex-1 text-sm font-semibold leading-snug break-words md:truncate ${
          mobileAlign === "right" ? "text-left md:text-right" : ""
        } ${emphasized ? "text-black" : "text-gray-700"}`}
      >
        {name}
      </span>
      {showPick && <PickMark />}
    </div>
  );
}

function MatchStatus({
  live,
  finished,
  status,
}: {
  live: boolean;
  finished: boolean;
  status: string;
}) {
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide ${
        live ? "text-red-600" : finished ? "text-gray-500" : "text-gray-400"
      }`}
    >
      {live && (
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 align-middle" />
      )}
      {getStatusLabel(status)}
    </span>
  );
}

function GoalLine({ event }: { event: MatchEvent }) {
  const ownGoal = event.detail.toLowerCase().includes("own");
  return (
    <p className="text-[10px] leading-tight break-words text-gray-600 sm:truncate">
      ⚽ {event.playerName}
      {ownGoal ? " (OG)" : ""} {formatEventMinute(event)}
    </p>
  );
}

function RedCardLine({ event }: { event: MatchEvent }) {
  return (
    <p className="text-[10px] leading-tight break-words text-red-700 sm:truncate">
      🟥 {event.playerName} {formatEventMinute(event)}
    </p>
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
  const events = match.match_events ?? [];
  const homeGoals = goalsForSide(events, "home");
  const awayGoals = goalsForSide(events, "away");
  const homeRedCards = redCardsForSide(events, "home");
  const awayRedCards = redCardsForSide(events, "away");
  const showEvents =
    showScore &&
    (homeGoals.length > 0 ||
      awayGoals.length > 0 ||
      homeRedCards.length > 0 ||
      awayRedCards.length > 0);

  const homeEmphasized =
    showScore &&
    match.home_score !== null &&
    match.away_score !== null &&
    match.home_score > match.away_score;
  const awayEmphasized =
    showScore &&
    match.home_score !== null &&
    match.away_score !== null &&
    match.away_score > match.home_score;

  return (
    <article
      className={`border-b border-gray-100 px-3 py-3 last:border-b-0 sm:px-4 ${
        live ? "bg-red-50/60" : "bg-white"
      }`}
    >
      {/* Mobile: score on top, teams stacked */}
      <div className="mb-2.5 flex flex-col items-center gap-0.5 md:hidden">
        {showScore ? (
          <span className="font-display text-2xl tracking-wide text-black">
            {formatScore(match)}
          </span>
        ) : (
          <span className="text-sm font-bold text-[#0056b3]">
            {formatPSTTime(match.kickoff_at)}
          </span>
        )}
        <MatchStatus live={live} finished={finished} status={match.status} />
      </div>

      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-3">
        <div className="min-w-0 flex-1">
          <TeamSide
            name={match.home_team_name}
            logo={match.home_team_logo}
            emphasized={homeEmphasized}
            showPick={showHomePick(pickedWinner)}
          />
        </div>

        <div className="hidden w-20 shrink-0 flex-col items-center md:flex">
          {showScore ? (
            <span className="font-display text-xl tracking-wide text-black">
              {formatScore(match)}
            </span>
          ) : (
            <span className="text-sm font-bold text-[#0056b3]">
              {formatPSTTime(match.kickoff_at)}
            </span>
          )}
          <span className="mt-0.5">
            <MatchStatus live={live} finished={finished} status={match.status} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <TeamSide
            name={match.away_team_name}
            logo={match.away_team_logo}
            emphasized={awayEmphasized}
            showPick={showAwayPick(pickedWinner)}
            mobileAlign="right"
          />
        </div>
      </div>

      {showEvents && (
        <div className="mt-2.5 space-y-2 border-t border-gray-100 pt-2.5 sm:mt-2 sm:grid sm:grid-cols-2 sm:gap-2 sm:space-y-0">
          <div className="min-w-0 space-y-0.5">
            {homeGoals.map((event) => (
              <GoalLine key={event.id} event={event} />
            ))}
            {homeRedCards.map((event) => (
              <RedCardLine key={event.id} event={event} />
            ))}
          </div>
          <div className="min-w-0 space-y-0.5 sm:text-right">
            {awayGoals.map((event) => (
              <GoalLine key={event.id} event={event} />
            ))}
            {awayRedCards.map((event) => (
              <RedCardLine key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}
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

type GamesView = "future" | "past" | "groups";

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
    { id: "groups", label: "Group Brackets" },
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
  groupBrackets: initialGroupBrackets = [],
  pickByMatchId = {},
  isLoggedIn = false,
}: GamesPageProps) {
  const router = useRouter();
  const [view, setView] = useState<GamesView>("future");
  const [groupBrackets, setGroupBrackets] =
    useState<GroupBracket[]>(initialGroupBrackets);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  async function loadGroupBrackets() {
    setGroupsLoading(true);
    setGroupsError(null);
    const res = await fetch("/api/games/standings");
    const data = await res.json();
    setGroupsLoading(false);

    if (res.ok && Array.isArray(data.groups) && data.groups.length > 0) {
      setGroupBrackets(data.groups);
      return;
    }

    setGroupsError(
      data.error ??
        (Array.isArray(data.groups) && data.groups.length === 0
          ? "No group tables returned from the API."
          : "Could not load group standings.")
    );
  }

  function selectView(next: GamesView) {
    setView(next);
    if (
      next === "groups" &&
      groupBrackets.length === 0 &&
      !groupsLoading
    ) {
      void loadGroupBrackets();
    }
  }

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

      <div
        className={`mx-auto space-y-6 px-4 py-6 md:px-8 ${
          view === "groups" ? "max-w-6xl" : "max-w-2xl"
        }`}
      >
        {isLoggedIn && (
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <PickMark />
            <span>
              Blue checkmark = the team you picked to win. Draw picks show on
              both teams.
            </span>
          </p>
        )}

        {view !== "groups" && (
          <MatchGroup
            title="Live Now"
            matches={live}
            variant="live"
            badge={live.length > 0 ? `${live.length} live` : undefined}
            pickByMatchId={pickByMatchId}
          />
        )}

        <ViewToggle view={view} onChange={selectView} />

        {view !== "groups" &&
          live.length === 0 &&
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

        {view === "groups" && (
          <GroupBrackets
            groups={groupBrackets}
            loading={groupsLoading}
            error={groupsError}
            onRetry={() => void loadGroupBrackets()}
          />
        )}
      </div>
    </div>
  );
}
