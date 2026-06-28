"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BracketPickPanel } from "@/components/BracketPickPanel";
import {
  formatRoundOf32Deadline,
  formatRoundOf32StartLabel,
  getRoundOf32LockAt,
  isKnockoutBracketLocked,
  isKnockoutBracketOpen,
  isPickLocked,
} from "@/lib/knockout-bracket";
import {
  buildVirtualMatch,
  getColumnById,
  isVirtualMatchId,
  slotPickToDisplayPick,
} from "@/lib/bracket-slot-picks";
import {
  deleteRemoteBracketSlotPick,
  saveRemoteBracketSlotPick,
} from "@/lib/bracket-slot-picks-client";
import {
  getSyncedMatchForSlotPick,
  slotPickToPickPayload,
} from "@/lib/migrate-bracket-slot-picks";
import {
  getBracketColumns,
  getKnockoutBracketProgress,
  type BracketMatchSlot,
  type BracketTeamPreview,
} from "@/lib/knockout-bracket-layout";
import { formatKickoffPST } from "@/lib/format-pst";
import { formatPickSummary } from "@/lib/scoring";
import type { BracketSlotPick, Match, Pick } from "@/lib/types";

interface KnockoutBracketViewProps {
  userId: string | null;
  matches: Match[];
  picks: Pick[];
  initialSlotPicks?: BracketSlotPick[];
  slotPicksTableMissing?: boolean;
  challengeSettings?: {
    knockout_unlocked?: boolean;
    group_stage_complete?: boolean;
  } | null;
}

function TeamLine({
  name,
  logo,
  picked,
  eliminated,
}: {
  name: string;
  logo: string | null;
  picked?: boolean;
  eliminated?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold ${
        picked
          ? "bg-[#0056b3]/15 text-[#0056b3] ring-1 ring-[#0056b3]/40"
          : "bg-white/80 text-gray-800"
      } ${eliminated ? "opacity-40 line-through" : ""}`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
      ) : (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[8px] font-bold text-gray-500">
          ?
        </span>
      )}
      <span className="truncate">{name}</span>
      {picked && (
        <span className="ml-auto shrink-0 text-[9px] font-black uppercase text-[#0056b3]">
          Pick
        </span>
      )}
    </div>
  );
}

function PlaceholderTeam({
  team,
  fallbackLabel,
}: {
  team?: BracketTeamPreview | null;
  fallbackLabel: string;
}) {
  if (team) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-lg bg-white/90 px-2 py-1.5 text-xs font-semibold text-gray-800 ring-1 ring-[#0056b3]/20">
        {team.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
        ) : (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[8px] font-bold text-gray-500">
            ?
          </span>
        )}
        <span className="truncate">{team.name}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-500">
      {fallbackLabel}
    </div>
  );
}

function BracketSlotCard({
  slot,
  pick,
  locked,
  onSelect,
}: {
  slot: BracketMatchSlot;
  pick?: Pick;
  locked: boolean;
  onSelect: () => void;
}) {
  if (slot.kind === "placeholder") {
    const hasHome = !!slot.homeTeam;
    const hasAway = !!slot.awayTeam;
    const hasBoth = hasHome && hasAway;
    const hasAny = hasHome || hasAway;
    const hasPick = !!slot.slotPick;
    const pickable = !!slot.pickable && !locked;
    const displayPick =
      slot.slotPick && slot.homeTeam && slot.awayTeam
        ? slotPickToDisplayPick(
            slot.slotPick,
            buildVirtualMatch(
              getColumnById(slot.columnId)!,
              slot.slotIndex,
              slot.homeTeam,
              slot.awayTeam
            )
          )
        : undefined;
    const homePicked = slot.slotPick?.picked_winner === "home";
    const awayPicked = slot.slotPick?.picked_winner === "away";

    if (pickable) {
      return (
        <button
          type="button"
          onClick={onSelect}
          className={`group relative w-full rounded-xl border p-3 text-left transition hover:scale-[1.02] hover:shadow-lg ${
            hasPick
              ? "border-[#32CD32]/50 bg-gradient-to-br from-[#f0fff4] to-white shadow-sm"
              : "border-[#0056b3]/40 bg-gradient-to-br from-[#f0f7ff] to-white shadow-sm hover:border-[#FF007A]/50"
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
              {slot.roundLabel} · Slot {slot.slotIndex + 1}
            </span>
            {hasPick ? (
              <span className="rounded-full bg-[#32CD32] px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                Picked
              </span>
            ) : (
              <span className="rounded-full bg-[#FF007A]/10 px-2 py-0.5 text-[9px] font-bold uppercase text-[#FF007A]">
                Tap to pick
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            <TeamLine
              name={slot.homeTeam!.name}
              logo={slot.homeTeam!.logo}
              picked={homePicked}
            />
            <TeamLine
              name={slot.awayTeam!.name}
              logo={slot.awayTeam!.logo}
              picked={awayPicked}
            />
          </div>
          {hasPick && displayPick && slot.homeTeam && slot.awayTeam && (
            <p className="mt-2 text-center text-[10px] font-bold uppercase text-[#1a7a1a]">
              {formatPickSummary(
                buildVirtualMatch(
                  getColumnById(slot.columnId)!,
                  slot.slotIndex,
                  slot.homeTeam,
                  slot.awayTeam
                ),
                displayPick
              )}
            </p>
          )}
        </button>
      );
    }

    return (
      <div
        className={`relative rounded-xl border border-dashed p-3 ${
          hasBoth
            ? "border-[#0056b3]/40 bg-gradient-to-br from-[#f0f7ff] to-gray-50/90 opacity-95"
            : hasAny
              ? "border-[#0056b3]/25 bg-gray-50/90 opacity-85"
              : "border-gray-300 bg-gray-50/80 opacity-70"
        }`}
      >
        <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-gray-400">
          {slot.roundLabel} · Slot {slot.slotIndex + 1}
        </p>
        <div className="space-y-1.5">
          <PlaceholderTeam team={slot.homeTeam} fallbackLabel={slot.homeLabel} />
          <PlaceholderTeam team={slot.awayTeam} fallbackLabel={slot.awayLabel} />
        </div>
        <p className="mt-2 text-center text-[10px] text-gray-400">
          Matches must finish for this to be determined
        </p>
      </div>
    );
  }

  const { match } = slot;
  const hasPick = !!pick;
  const homePicked = pick?.picked_winner === "home";
  const awayPicked = pick?.picked_winner === "away";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full rounded-xl border p-3 text-left transition hover:scale-[1.02] hover:shadow-lg ${
        hasPick
          ? "border-[#32CD32]/50 bg-gradient-to-br from-[#f0fff4] to-white shadow-sm"
          : locked
            ? "border-amber-200 bg-amber-50/50"
            : "border-[#0056b3]/30 bg-white shadow-sm hover:border-[#FF007A]/50"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
          M{slot.slotIndex + 1}
        </span>
        {hasPick ? (
          <span className="rounded-full bg-[#32CD32] px-2 py-0.5 text-[9px] font-bold uppercase text-white">
            Picked
          </span>
        ) : (
          <span className="rounded-full bg-[#FF007A]/10 px-2 py-0.5 text-[9px] font-bold uppercase text-[#FF007A]">
            {locked ? "Missed" : "Tap to pick"}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <TeamLine
          name={match.home_team_name}
          logo={match.home_team_logo}
          picked={homePicked}
        />
        <TeamLine
          name={match.away_team_name}
          logo={match.away_team_logo}
          picked={awayPicked}
        />
      </div>

      {hasPick && pick && (
        <p className="mt-2 text-center text-[10px] font-bold uppercase text-[#1a7a1a]">
          {formatPickSummary(match, pick)}
        </p>
      )}

      <p className="mt-1.5 text-center text-[9px] text-gray-400">
        {formatKickoffPST(match.kickoff_at)}
      </p>
    </button>
  );
}

export function KnockoutBracketView({
  userId,
  matches,
  picks: initialPicks,
  initialSlotPicks = [],
  slotPicksTableMissing = false,
}: KnockoutBracketViewProps) {
  const [picks, setPicks] = useState(initialPicks);
  const [slotPicks, setSlotPicks] = useState<BracketSlotPick[]>(initialSlotPicks);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [activeSlotPick, setActiveSlotPick] = useState<
    BracketSlotPick | undefined
  >(undefined);

  const pickMap = useMemo(() => {
    const map = new Map<number, Pick>();
    picks.forEach((p) => map.set(p.match_id, p));
    return map;
  }, [picks]);

  const bracketLocked = isKnockoutBracketLocked(matches);
  const bracketOpen = isKnockoutBracketOpen(matches);
  const lockAt = getRoundOf32LockAt(matches);
  const columns = getBracketColumns(matches, picks, slotPicks);
  const progress = getKnockoutBracketProgress(matches, picks);
  const pct =
    progress.syncedFixtures > 0
      ? Math.round((progress.picksOnSynced / progress.syncedFixtures) * 100)
      : 0;

  useEffect(() => {
    if (!userId || bracketLocked || slotPicksTableMissing) return;
    if (!slotPicks.length) return;

    let cancelled = false;

    async function migrateSyncedSlotPicks() {
      const remaining: BracketSlotPick[] = [];

      for (const slotPick of slotPicks) {
        const syncedMatch = getSyncedMatchForSlotPick(matches, slotPick);
        if (!syncedMatch) {
          remaining.push(slotPick);
          continue;
        }

        const res = await fetch("/api/picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slotPickToPickPayload(slotPick, syncedMatch)),
        });

        if (cancelled) return;

        if (!res.ok) {
          remaining.push(slotPick);
          continue;
        }

        const data = await res.json();
        setPicks((prev) => {
          const idx = prev.findIndex((p) => p.match_id === syncedMatch.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = data.pick;
            return next;
          }
          return [...prev, data.pick];
        });

        await deleteRemoteBracketSlotPick(
          slotPick.round_id,
          slotPick.slot_index
        ).catch((err) => {
          console.error("Failed to delete migrated bracket slot pick:", err);
          remaining.push(slotPick);
        });
      }

      if (!cancelled) {
        setSlotPicks(remaining);
      }
    }

    void migrateSyncedSlotPicks();
    return () => {
      cancelled = true;
    };
  }, [userId, matches, bracketLocked, slotPicksTableMissing, slotPicks.length]);

  function handleSaved(pick: Pick) {
    setPicks((prev) => {
      const idx = prev.findIndex((p) => p.match_id === pick.match_id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = pick;
        return next;
      }
      return [...prev, pick];
    });
  }

  async function handleSlotSaved(slotPick: BracketSlotPick) {
    if (!userId) {
      throw new Error("Sign in to save bracket picks.");
    }

    const saved = await saveRemoteBracketSlotPick(slotPick);
    setSlotPicks((prev) => {
      const index = prev.findIndex(
        (item) =>
          item.round_id === saved.round_id &&
          item.slot_index === saved.slot_index
      );
      if (index >= 0) {
        const next = [...prev];
        next[index] = saved;
        return next;
      }
      return [...prev, saved];
    });
  }

  function openSlot(slot: Extract<BracketMatchSlot, { kind: "placeholder" }>) {
    if (!slot.pickable || !slot.homeTeam || !slot.awayTeam) return;
    const column = getColumnById(slot.columnId);
    if (!column) return;
    setActiveSlotPick(slot.slotPick);
    setActiveMatch(
      buildVirtualMatch(column, slot.slotIndex, slot.homeTeam, slot.awayTeam)
    );
  }

  function closePickPanel() {
    setActiveMatch(null);
    setActiveSlotPick(undefined);
  }

  if (!bracketOpen) {
    return (
      <div className="min-h-screen bg-[#0a1628]">
        <header className="border-b border-white/10 bg-gradient-to-b from-[#0056b3] to-[#0a1628] px-4 py-10 text-center text-white sm:px-6 sm:text-left">
          <h1 className="text-4xl font-black uppercase tracking-tight md:text-5xl">
            Knockout Bracket
          </h1>
          <p className="mt-2 text-sm text-white/70">
            NCAA March Madness style — fill every knockout match before the
            bracket deadline.
          </p>
        </header>
        <p className="px-6 py-16 text-center text-gray-300">
          Bracket locked — the deadline was{" "}
          {formatRoundOf32Deadline(getRoundOf32LockAt(matches))}. Picks can no
          longer be changed.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <header className="border-b border-white/10 bg-gradient-to-b from-[#0056b3] via-[#0a1628] to-[#0a1628] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#FFD700]">
              March Madness Style
            </p>
            <h1 className="mt-1 text-4xl font-black uppercase tracking-tight md:text-5xl">
              Knockout Bracket
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              Pick the winner and score for every knockout match. Fill your full
              bracket before {formatRoundOf32Deadline(lockAt)} — same points as
              regular picks, added to your standings total.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-[#FF007A]/40 bg-[#FF007A]/10 px-4 py-3 text-center md:text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF007A]">
              {bracketLocked ? "Bracket locked" : "Locks at"}
            </p>
            <p className="mt-0.5 text-sm font-bold text-white">
              {bracketLocked
                ? "Deadline passed"
                : formatRoundOf32Deadline(lockAt)}
            </p>
          </div>
        </div>
      </header>

      <div className="border-b border-white/10 bg-black/40 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">
                {progress.picksOnSynced} of {progress.syncedFixtures} synced
                matches picked
              </p>
              <p className="text-xs text-gray-400">
                {progress.syncedFixtures} of {progress.expectedFixtures} total
                knockout fixtures loaded · first Ro32:{" "}
                {formatRoundOf32StartLabel()}
              </p>
            </div>
            <span
              className={`rounded-full px-4 py-1.5 text-xs font-black uppercase ${
                progress.complete
                  ? "bg-[#32CD32] text-black"
                  : "bg-[#FF007A] text-white"
              }`}
            >
              {progress.complete ? "Bracket complete" : `${pct}% done`}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FF007A] to-[#FFD700] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {!bracketLocked && progress.picksOnSynced < progress.syncedFixtures && (
        <div className="border-b border-[#FF007A]/20 bg-[#FF007A]/10 px-4 py-2 text-center text-xs font-medium text-[#ffb3d9] sm:px-6">
          Submit picks for all loaded matches before{" "}
          {formatRoundOf32Deadline(lockAt)} — the entire bracket locks at the
          deadline.
        </div>
      )}

      <div className="overflow-x-auto px-4 py-8 sm:px-6">
        <div className="mx-auto flex min-w-max max-w-none gap-4 md:gap-6">
          {columns.map(({ column, slots, points }) => (
            <section
              key={column.id}
              className="flex w-[220px] shrink-0 flex-col sm:w-[240px]"
            >
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center backdrop-blur-sm">
                <h2 className="text-xs font-black uppercase tracking-widest text-[#FFD700]">
                  {column.label}
                </h2>
                <p className="mt-0.5 text-[10px] text-gray-400">
                  +{points} winner · +5 exact
                </p>
              </div>

              <div className="flex flex-1 flex-col justify-around gap-3">
                {slots.map((slot, index) => (
                  <div key={`${column.id}-${index}`} className="relative">
                    {slot.kind === "match" && index % 2 === 0 && index > 0 && (
                      <div
                        className="pointer-events-none absolute -top-2 left-1/2 hidden h-2 w-px -translate-x-1/2 bg-[#0056b3]/40 md:block"
                        aria-hidden
                      />
                    )}
                    <BracketSlotCard
                      slot={slot}
                      pick={
                        slot.kind === "match"
                          ? pickMap.get(slot.match.id)
                          : undefined
                      }
                      locked={bracketLocked}
                      onSelect={() => {
                        if (slot.kind === "match") {
                          setActiveSlotPick(undefined);
                          setActiveMatch(slot.match);
                        } else if (slot.pickable) {
                          openSlot(slot);
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-8 text-center sm:px-6">
        <p className="text-xs text-gray-500">
          Your picks advance through the bracket automatically. When every Round
          of 32 match on a side is synced, you can keep picking that half all
          the way through — the other half unlocks as fixtures load.
        </p>
        <Link
          href="/rules"
          className="mt-3 inline-block text-sm font-bold uppercase tracking-wide text-[#FFD700] hover:underline"
        >
          Read knockout rules →
        </Link>
      </div>

      {activeMatch && (
        <BracketPickPanel
          match={activeMatch}
          pick={pickMap.get(activeMatch.id)}
          slotPick={activeSlotPick}
          userId={userId ?? undefined}
          locked={
            isVirtualMatchId(activeMatch.id)
              ? bracketLocked
              : isPickLocked(activeMatch, matches)
          }
          onClose={closePickPanel}
          onSaved={handleSaved}
          onSlotSaved={handleSlotSaved}
        />
      )}
    </div>
  );
}
