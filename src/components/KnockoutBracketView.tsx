"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BracketInspectorBar } from "@/components/BracketInspectorBar";
import type { BracketInspectorOption } from "@/components/BracketInspectorBar";
import { BracketPickPanel } from "@/components/BracketPickPanel";
import { FinishedMatchPickSummary } from "@/components/FinishedMatchPickSummary";
import { EliminationMark } from "@/components/EliminatedTeamName";
import {
  formatRoundOf32StartLabel,
  isKnockoutChallengeActive,
  isPickLocked,
} from "@/lib/knockout-bracket";
import {
  buildVirtualMatch,
  getColumnById,
  isVirtualMatchId,
  parseVirtualMatchSlot,
  slotPickToDisplayPick,
} from "@/lib/bracket-slot-picks";
import {
  deleteRemoteBracketSlotPick,
  saveRemoteBracketSlotPick,
} from "@/lib/bracket-slot-picks-client";
import {
  getSyncedMatchForSlotPick,
  isBracketSlotPickLocked,
  slotPickToPickPayload,
} from "@/lib/migrate-bracket-slot-picks";
import {
  getBracketColumns,
  getKnockoutBracketProgress,
  type BracketMatchSlot,
  type BracketTeamPreview,
} from "@/lib/knockout-bracket-layout";
import { formatKickoffPST } from "@/lib/format-pst";
import {
  formatScore,
  getMatchBucket,
  getStatusLabel,
} from "@/lib/match-status";
import { formatPickSummary, isMatchFinished } from "@/lib/scoring";
import {
  BRACKET_PLACEHOLDER_KICKOFF,
  isKnockoutSideLost,
  type TeamEliminationChecker,
} from "@/lib/team-elimination-display";
import { useTeamElimination } from "@/hooks/useTeamElimination";
import { getLockedWinnerForSlot } from "@/lib/bracket-slot-chaining";
import type { BracketSlotPick, Match, Pick } from "@/lib/types";

function slotKickoffForElimination(slot: BracketMatchSlot): string {
  if (slot.kind === "match") return slot.match.kickoff_at;
  return BRACKET_PLACEHOLDER_KICKOFF;
}

function isSlotTeamEliminated(
  slot: BracketMatchSlot,
  side: "home" | "away",
  checkEliminated?: TeamEliminationChecker
): boolean {
  const cutoff = slotKickoffForElimination(slot);
  if (slot.kind === "match") {
    if (isKnockoutSideLost(slot.match, side)) return true;
    if (!checkEliminated) return false;
    const teamId =
      side === "home" ? slot.match.home_team_id : slot.match.away_team_id;
    return checkEliminated(teamId, cutoff);
  }
  if (!checkEliminated) return false;
  const team = side === "home" ? slot.homeTeam : slot.awayTeam;
  if (!team) return false;
  return checkEliminated(team.id, cutoff);
}

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
  readOnly?: boolean;
  viewingProfile?: { username: string; display_name: string } | null;
  inspectorProfiles?: BracketInspectorOption[];
  displayedUserId?: string | null;
  selfUsername?: string | null;
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
      } ${eliminated ? "opacity-70" : ""}`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          className={`h-4 w-4 shrink-0 object-contain ${eliminated ? "grayscale" : ""}`}
        />
      ) : (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[8px] font-bold text-gray-500">
          ?
        </span>
      )}
      <span className={`min-w-0 flex-1 truncate ${eliminated ? "line-through decoration-red-400/80" : ""}`}>
        {name}
      </span>
      {eliminated && <EliminationMark />}
      {picked && !eliminated && (
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
  eliminated,
}: {
  team?: BracketTeamPreview | null;
  fallbackLabel: string;
  eliminated?: boolean;
}) {
  if (team) {
    return (
      <div
        className={`flex min-w-0 items-center gap-2 rounded-lg bg-white/90 px-2 py-1.5 text-xs font-semibold text-gray-800 ring-1 ring-[#0056b3]/20 ${
          eliminated ? "opacity-70" : ""
        }`}
      >
        {team.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={team.logo}
            alt=""
            className={`h-4 w-4 shrink-0 object-contain ${eliminated ? "grayscale" : ""}`}
          />
        ) : (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[8px] font-bold text-gray-500">
            ?
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate ${
            eliminated ? "line-through decoration-red-400/80" : ""
          }`}
        >
          {team.name}
        </span>
        {eliminated && <EliminationMark />}
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
  readOnly = false,
  onSelect,
  checkEliminated,
}: {
  slot: BracketMatchSlot;
  pick?: Pick;
  locked: boolean;
  readOnly?: boolean;
  onSelect: () => void;
  checkEliminated?: TeamEliminationChecker;
}) {
  const homeEliminated = isSlotTeamEliminated(slot, "home", checkEliminated);
  const awayEliminated = isSlotTeamEliminated(slot, "away", checkEliminated);
  const chaining = slot.chaining;

  if (chaining?.status === "bust") {
    return (
      <div className="relative rounded-xl border border-dashed border-gray-400 bg-gray-100/90 p-3 opacity-80">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">
          {slot.kind === "placeholder"
            ? `${slot.roundLabel} · Slot ${slot.slotIndex + 1}`
            : `M${slot.slotIndex + 1}`}
        </p>
        <p className="text-center text-[10px] font-bold uppercase text-gray-600">
          Bracket bust
        </p>
        <p className="mt-1 text-center text-[9px] text-gray-500">
          Both feeder picks were wrong — 0 pts on this path
        </p>
      </div>
    );
  }

  if (slot.kind === "placeholder" && chaining?.status === "pending") {
    const hasHome = !!slot.homeTeam;
    const hasAway = !!slot.awayTeam;
    const hasAny = hasHome || hasAway;
    return (
      <div
        className={`relative rounded-xl border border-dashed p-3 ${
          hasAny
            ? "border-[#0056b3]/25 bg-gray-50/90 opacity-85"
            : "border-gray-300 bg-gray-50/80 opacity-70"
        }`}
      >
        <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-gray-400">
          {slot.roundLabel} · Slot {slot.slotIndex + 1}
        </p>
        <div className="space-y-1.5">
          <PlaceholderTeam
            team={slot.homeTeam}
            fallbackLabel={slot.homeLabel}
            eliminated={homeEliminated}
          />
          <PlaceholderTeam
            team={slot.awayTeam}
            fallbackLabel={slot.awayLabel}
            eliminated={awayEliminated}
          />
        </div>
        <p className="mt-2 text-center text-[10px] text-gray-500">
          Waiting on feeder matches to finish
        </p>
      </div>
    );
  }

  if (slot.kind === "placeholder") {
    const hasHome = !!slot.homeTeam;
    const hasAway = !!slot.awayTeam;
    const hasBoth = hasHome && hasAway;
    const hasAny = hasHome || hasAway;
    const hasPick = !!slot.slotPick;
    const pickable = !!slot.pickable && !locked;
    const canOpen = pickable || (readOnly && hasPick);
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

    if (canOpen) {
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
            ) : chaining?.status === "forced" ? (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                Winner locked
              </span>
            ) : readOnly ? (
              <span className="rounded-full bg-[#FFD700]/20 px-2 py-0.5 text-[9px] font-bold uppercase text-[#FFD700]">
                View pick
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
              eliminated={homeEliminated}
            />
            <TeamLine
              name={slot.awayTeam!.name}
              logo={slot.awayTeam!.logo}
              picked={awayPicked}
              eliminated={awayEliminated}
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
          <PlaceholderTeam
            team={slot.homeTeam}
            fallbackLabel={slot.homeLabel}
            eliminated={homeEliminated}
          />
          <PlaceholderTeam
            team={slot.awayTeam}
            fallbackLabel={slot.awayLabel}
            eliminated={awayEliminated}
          />
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
  const isLive = getMatchBucket(match) === "live";
  const isFinished = isMatchFinished(match.status);
  const isLocked = locked || isFinished;

  if (readOnly) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`relative w-full rounded-xl border p-3 text-left transition hover:scale-[1.01] hover:shadow-md ${
          isFinished
            ? "border-gray-300 bg-gray-100/90"
            : hasPick
              ? "border-[#FFD700]/40 bg-[#1a1400]/40"
              : "border-gray-300 bg-gray-50/90"
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
            M{slot.slotIndex + 1}
          </span>
          <span className="rounded-full bg-[#FFD700]/20 px-2 py-0.5 text-[9px] font-bold uppercase text-[#FFD700]">
            View pick
          </span>
        </div>

        <div className="space-y-1.5">
          <TeamLine
            name={match.home_team_name}
            logo={match.home_team_logo}
            picked={homePicked}
            eliminated={homeEliminated}
          />
          <TeamLine
            name={match.away_team_name}
            logo={match.away_team_logo}
            picked={awayPicked}
            eliminated={awayEliminated}
          />
        </div>

        <FinishedMatchPickSummary match={match} pick={pick} />

        {!hasPick && (
          <p className="mt-2 text-center text-[10px] font-medium text-gray-500">
            No pick saved
          </p>
        )}
      </button>
    );
  }

  if (isLocked && !isLive) {
    return (
      <div
        className={`relative w-full rounded-xl border p-3 ${
          isFinished
            ? "border-gray-300 bg-gray-100/90"
            : "border-amber-200 bg-amber-50/80"
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
            M{slot.slotIndex + 1}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase text-white ${
              isFinished ? "bg-gray-500" : "bg-amber-600"
            }`}
          >
            {isFinished ? "Final — locked" : "Locked"}
          </span>
        </div>

        <div className="space-y-1.5">
          <TeamLine
            name={match.home_team_name}
            logo={match.home_team_logo}
            picked={homePicked}
            eliminated={homeEliminated}
          />
          <TeamLine
            name={match.away_team_name}
            logo={match.away_team_logo}
            picked={awayPicked}
            eliminated={awayEliminated}
          />
        </div>

        <FinishedMatchPickSummary match={match} pick={pick} />

        {!isFinished && hasPick && pick && (
          <p className="mt-2 text-center text-[10px] font-bold uppercase text-gray-600">
            Your pick: {formatPickSummary(match, pick)}
          </p>
        )}

        {!isFinished && !hasPick && (
          <p className="mt-2 text-center text-[10px] font-medium text-amber-800">
            No pick — locked at kickoff
          </p>
        )}

        <p className="mt-1.5 text-center text-[9px] text-gray-500">
          {isFinished
            ? "Picks cannot be changed after the match ends"
            : "Picks lock once the match starts"}
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full rounded-xl border p-3 text-left transition hover:scale-[1.02] hover:shadow-lg ${
        isLive
          ? "border-red-500 bg-gradient-to-br from-red-50 to-red-100/80 shadow-md ring-2 ring-red-300"
          : hasPick
            ? "border-[#32CD32]/50 bg-gradient-to-br from-[#f0fff4] to-white shadow-sm"
            : locked
              ? "border-amber-200 bg-amber-50/50"
              : "border-[#0056b3]/30 bg-white shadow-sm hover:border-[#FF007A]/50"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`text-[9px] font-bold uppercase tracking-wider ${
            isLive ? "text-red-600" : "text-gray-400"
          }`}
        >
          M{slot.slotIndex + 1}
        </span>
        {isLive ? (
          <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
        ) : hasPick ? (
          <span className="rounded-full bg-[#32CD32] px-2 py-0.5 text-[9px] font-bold uppercase text-white">
            Picked
          </span>
        ) : chaining?.status === "forced" ? (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
            Winner locked
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
          eliminated={homeEliminated}
        />
        <TeamLine
          name={match.away_team_name}
          logo={match.away_team_logo}
          picked={awayPicked}
          eliminated={awayEliminated}
        />
      </div>

      {isLive && match.home_score !== null && match.away_score !== null && (
        <p className="mt-2 text-center font-display text-lg font-black tracking-wide text-red-700">
          {formatScore(match)}
        </p>
      )}

      {hasPick && pick && !isLive && (
        <p className="mt-2 text-center text-[10px] font-bold uppercase text-[#1a7a1a]">
          {formatPickSummary(match, pick)}
        </p>
      )}

      {hasPick && pick && isLive && (
        <p className="mt-1 text-center text-[10px] font-bold uppercase text-red-800">
          Your pick: {formatPickSummary(match, pick)}
        </p>
      )}

      {isLive ? (
        <p className="mt-1.5 text-center text-[9px] font-bold uppercase text-red-600">
          {getStatusLabel(match.status)}
        </p>
      ) : (
        <p className="mt-1.5 text-center text-[9px] text-gray-400">
          {formatKickoffPST(match.kickoff_at)}
        </p>
      )}
    </button>
  );
}

export function KnockoutBracketView({
  userId,
  matches,
  picks: initialPicks,
  initialSlotPicks = [],
  slotPicksTableMissing = false,
  challengeSettings,
  readOnly = false,
  viewingProfile = null,
  inspectorProfiles,
  displayedUserId = null,
  selfUsername = null,
}: KnockoutBracketViewProps) {
  const [picks, setPicks] = useState(initialPicks);
  const [slotPicks, setSlotPicks] = useState<BracketSlotPick[]>(initialSlotPicks);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [activeSlotPick, setActiveSlotPick] = useState<
    BracketSlotPick | undefined
  >(undefined);
  const [activeColumnId, setActiveColumnId] = useState<string>("ro32");

  const pickMap = useMemo(() => {
    const map = new Map<number, Pick>();
    picks.forEach((p) => map.set(p.match_id, p));
    return map;
  }, [picks]);

  const checkEliminated = useTeamElimination(picks, matches);

  const bracketOpen = isKnockoutChallengeActive(matches, challengeSettings);
  const columns = getBracketColumns(matches, picks, slotPicks);
  const progress = getKnockoutBracketProgress(matches, picks);
  const pct =
    progress.syncedFixtures > 0
      ? Math.round((progress.picksOnSynced / progress.syncedFixtures) * 100)
      : 0;

  const liveColumnIds = useMemo(() => {
    const ids = new Set<string>();
    for (const { column, slots } of columns) {
      for (const slot of slots) {
        if (slot.kind === "match" && getMatchBucket(slot.match) === "live") {
          ids.add(column.id);
        }
      }
    }
    return ids;
  }, [columns]);

  const liveKnockoutCount = useMemo(
    () =>
      matches.filter(
        (m) => m.stage === "knockout" && getMatchBucket(m) === "live"
      ).length,
    [matches]
  );

  function isSlotLocked(slot: BracketMatchSlot): boolean {
    if (slot.kind === "match") {
      return isPickLocked(slot.match, matches);
    }
    if (slot.slotPick) {
      return isBracketSlotPickLocked(slot.slotPick, matches);
    }
    return false;
  }

  const columnSummaries = useMemo(
    () =>
      columns.map(({ column, slots }) => {
        let pickable = 0;
        let picked = 0;
        for (const slot of slots) {
          const countsTowardPickable =
            slot.chaining?.status !== "bust" &&
            slot.chaining?.status !== "pending";
          if (slot.kind === "match") {
            if (countsTowardPickable) {
              pickable += 1;
              if (pickMap.has(slot.match.id)) picked += 1;
            }
          } else if (slot.pickable && countsTowardPickable) {
            pickable += 1;
            if (slot.slotPick) picked += 1;
          }
        }
        return { columnId: column.id, label: column.label, pickable, picked };
      }),
    [columns, pickMap]
  );

  const activeColumn =
    columns.find(({ column }) => column.id === activeColumnId) ?? columns[0];

  const activeColumnSummary = columnSummaries.find(
    (s) => s.columnId === activeColumn?.column.id
  );
  const activeColumnIdx = columns.findIndex(
    ({ column }) => column.id === activeColumn?.column.id
  );
  const nextColumnSummary =
    activeColumnIdx >= 0 ? columnSummaries[activeColumnIdx + 1] : undefined;
  const activeColumnComplete =
    !!activeColumnSummary &&
    activeColumnSummary.pickable > 0 &&
    activeColumnSummary.picked >= activeColumnSummary.pickable;

  function goToColumn(columnId: string) {
    setActiveColumnId(columnId);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function findNextPickableSlot(
    fromColumnId: string,
    fromSlotIndex: number | null
  ): { columnId: string; slot: BracketMatchSlot } | null {
    const startColumnIdx = columns.findIndex(
      ({ column }) => column.id === fromColumnId
    );
    if (startColumnIdx < 0) return null;

    for (let offset = 0; offset < columns.length; offset++) {
      const colIdx = (startColumnIdx + offset) % columns.length;
      const { column, slots } = columns[colIdx];
      for (const slot of slots) {
        if (offset === 0 && fromSlotIndex !== null) {
          if (slot.slotIndex <= fromSlotIndex) continue;
        }
        if (slot.kind === "match") {
          if (
            slot.chaining?.status === "bust" ||
            slot.chaining?.status === "pending"
          ) {
            continue;
          }
          if (
            !pickMap.has(slot.match.id) &&
            !isPickLocked(slot.match, matches)
          ) {
            return { columnId: column.id, slot };
          }
        } else if (slot.pickable && !slot.slotPick) {
          return { columnId: column.id, slot };
        }
      }
    }
    return null;
  }

  function openNextPick(after: { columnId: string; slotIndex: number } | null) {
    const start = after ?? { columnId: columns[0]?.column.id ?? "ro32", slotIndex: -1 };
    const next = findNextPickableSlot(start.columnId, start.slotIndex);
    if (!next) return false;
    setActiveColumnId(next.columnId);
    if (next.slot.kind === "match") {
      setActiveSlotPick(undefined);
      setActiveMatch(next.slot.match);
    } else if (next.slot.kind === "placeholder") {
      openSlot(next.slot);
    }
    return true;
  }

  function handleSlotSelect(slot: BracketMatchSlot) {
    if (readOnly) {
      if (slot.kind === "match") {
        setActiveSlotPick(undefined);
        setActiveMatch(slot.match);
        return;
      }
      if (slot.kind === "placeholder" && slot.slotPick) {
        openSlot(slot);
      }
      return;
    }
    if (isSlotLocked(slot)) return;
    if (slot.kind === "match") {
      setActiveSlotPick(undefined);
      setActiveMatch(slot.match);
    } else if (slot.pickable) {
      openSlot(slot);
    }
  }

  useEffect(() => {
    if (!userId || slotPicksTableMissing || readOnly) return;
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
  }, [userId, matches, slotPicksTableMissing, slotPicks.length, readOnly]);

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
          Pick winners and scores for each knockout match. You can change any
          pick until that match kicks off — if a team you picked loses early,
          later picks with that team are crossed out.
        </p>
        </header>
        <p className="px-6 py-16 text-center text-gray-300">
          The knockout bracket is not open yet. Check back once group stage
          matches start finishing.
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
              Pick the winner and score for each knockout match. Change any pick
              until that game kicks off — same points as regular picks, added to
              your standings total.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-[#32CD32]/40 bg-[#32CD32]/10 px-4 py-3 text-center md:text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#32CD32]">
              Per-match lock
            </p>
            <p className="mt-0.5 text-sm font-bold text-white">
              Editable until kickoff
            </p>
          </div>
        </div>
      </header>

      {inspectorProfiles && displayedUserId && selfUsername && (
        <BracketInspectorBar
          profiles={inspectorProfiles}
          activeUserId={displayedUserId}
          selfUsername={selfUsername}
        />
      )}

      {readOnly && viewingProfile && (
        <div className="border-b border-[#FFD700]/30 bg-[#FFD700]/10 px-4 py-2.5 text-center text-sm text-[#FFD700] sm:px-6">
          Viewing{" "}
          <span className="font-black">{viewingProfile.display_name}</span>
          &apos;s bracket (@{viewingProfile.username}) — read only
        </div>
      )}

      {liveKnockoutCount > 0 && (
        <div className="border-b border-red-500/40 bg-red-600/20 px-4 py-2.5 text-center text-sm font-bold text-red-100 sm:px-6">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-red-400 align-middle" />
          {liveKnockoutCount} live knockout match
          {liveKnockoutCount !== 1 ? "es" : ""} — highlighted in red below
        </div>
      )}

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

      {progress.picksOnSynced < progress.syncedFixtures && (
        <div className="border-b border-[#FF007A]/20 bg-[#FF007A]/10 px-4 py-2 text-center text-xs font-medium text-[#ffb3d9] sm:px-6">
          Pick every synced match you can — each slot locks when that game
          starts. First Ro32 kickoff: {formatRoundOf32StartLabel()}.
        </div>
      )}

      {/* Mobile round tabs — one column at a time, no horizontal scroll */}
      <div className="sticky top-0 z-30 -mx-px border-y border-white/10 bg-[#0a1628]/95 px-3 py-2 backdrop-blur md:hidden">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {columnSummaries.map(({ columnId, label, pickable, picked }) => {
            const isActive = activeColumnId === columnId;
            const isComplete = pickable > 0 && picked >= pickable;
            const hasLive = liveColumnIds.has(columnId);
            return (
              <button
                key={columnId}
                type="button"
                onClick={() => setActiveColumnId(columnId)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
                  hasLive
                    ? isActive
                      ? "border-red-400 bg-red-600 text-white shadow ring-2 ring-red-300"
                      : "border-red-500/70 bg-red-950/60 text-red-200"
                    : isActive
                      ? "border-[#FF007A] bg-[#FF007A] text-white shadow"
                      : isComplete
                        ? "border-[#32CD32]/60 bg-[#32CD32]/15 text-[#9be39b]"
                        : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                <span>{label}</span>
                {pickable > 0 && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${
                      isActive
                        ? "bg-white/20"
                        : isComplete
                          ? "bg-[#32CD32]/30"
                          : "bg-black/30"
                    }`}
                  >
                    {picked}/{pickable}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: single-column stacked view */}
      <div className="px-4 py-5 sm:px-6 md:hidden">
        {activeColumn && (
          <section className="mx-auto max-w-md">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-black uppercase tracking-wide text-[#FFD700]">
                  {activeColumn.column.label}
                </h2>
                <p className="text-[11px] text-gray-400">
                  +{activeColumn.points} winner · +5 exact
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  openNextPick({
                    columnId: activeColumn.column.id,
                    slotIndex: -1,
                  })
                }
                disabled={activeColumnComplete || readOnly}
                className="shrink-0 rounded-full bg-[#FF007A] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow disabled:opacity-50"
              >
                Next pick →
              </button>
            </div>
            <div className="space-y-3">
              {activeColumn.slots.map((slot, index) => (
                <BracketSlotCard
                  key={`${activeColumn.column.id}-${index}`}
                  slot={slot}
                  pick={
                    slot.kind === "match"
                      ? pickMap.get(slot.match.id)
                      : undefined
                  }
                  locked={isSlotLocked(slot)}
                  readOnly={readOnly}
                  checkEliminated={checkEliminated}
                  onSelect={() => handleSlotSelect(slot)}
                />
              ))}
            </div>

            {activeColumnComplete && (
              <div className="mt-6 rounded-2xl border border-[#32CD32]/40 bg-gradient-to-br from-[#0a4f1a]/40 to-[#0a1628] p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#32CD32]">
                  {activeColumn.column.label} complete
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  {nextColumnSummary
                    ? `Nice — every pick made. Continue to ${nextColumnSummary.label}.`
                    : "You're all set — your bracket is complete!"}
                </p>
                {nextColumnSummary ? (
                  <button
                    type="button"
                    onClick={() => goToColumn(nextColumnSummary.columnId)}
                    className="mt-3 w-full rounded-full bg-gradient-to-r from-[#FF007A] to-[#FFD700] py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg transition hover:opacity-95"
                  >
                    Next: {nextColumnSummary.label} →
                  </button>
                ) : (
                  <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[#FFD700]">
                    🏆 Bracket complete
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Desktop: full bracket tree */}
      <div className="hidden overflow-x-auto px-4 py-8 sm:px-6 md:block">
        <div className="mx-auto flex min-w-max max-w-none gap-4 md:gap-6">
          {columns.map(({ column, slots, points }) => {
            const summary = columnSummaries.find((s) => s.columnId === column.id);
            const isColumnComplete =
              !!summary && summary.pickable > 0 && summary.picked >= summary.pickable;
            return (
            <section
              key={column.id}
              className="flex w-[220px] shrink-0 flex-col sm:w-[240px]"
            >
              <div
                className={`mb-4 rounded-xl border px-3 py-2 text-center backdrop-blur-sm ${
                  isColumnComplete
                    ? "border-[#32CD32]/50 bg-[#32CD32]/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <h2 className="text-xs font-black uppercase tracking-widest text-[#FFD700]">
                  {isColumnComplete && "✓ "}
                  {column.label}
                </h2>
                <p className="mt-0.5 text-[10px] text-gray-400">
                  {summary
                    ? `${summary.picked}/${summary.pickable} picked · `
                    : ""}
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
                      locked={isSlotLocked(slot)}
                      readOnly={readOnly}
                      checkEliminated={checkEliminated}
                      onSelect={() => handleSlotSelect(slot)}
                    />
                  </div>
                ))}
              </div>
            </section>
            );
          })}
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

      {activeMatch &&
        (() => {
          const virtual = parseVirtualMatchSlot(activeMatch.id);
          const from = virtual
            ? { columnId: virtual.roundId, slotIndex: virtual.slotIndex }
            : (() => {
                for (const { column, slots } of columns) {
                  for (const slot of slots) {
                    if (
                      slot.kind === "match" &&
                      slot.match.id === activeMatch.id
                    ) {
                      return { columnId: column.id, slotIndex: slot.slotIndex };
                    }
                  }
                }
                return null;
              })();

          const next = from
            ? findNextPickableSlot(from.columnId, from.slotIndex)
            : null;
          const nextRoundLabel =
            next && from && next.columnId !== from.columnId
              ? columnSummaries.find((s) => s.columnId === next.columnId)?.label ??
                null
              : null;

          let activeChaining = undefined;
          if (from) {
            for (const { column, slots } of columns) {
              if (column.id !== from.columnId) continue;
              const slot = slots.find((s) => s.slotIndex === from.slotIndex);
              if (slot) {
                activeChaining = slot.chaining;
                break;
              }
            }
          }

          const lockedWinner =
            from && activeChaining
              ? getLockedWinnerForSlot(
                  from.columnId,
                  from.slotIndex,
                  activeMatch,
                  activeChaining
                )
              : null;

          return (
            <BracketPickPanel
              match={activeMatch}
              pick={pickMap.get(activeMatch.id)}
              slotPick={activeSlotPick}
              userId={userId ?? undefined}
              checkEliminated={checkEliminated}
              lockedWinner={lockedWinner}
              locked={
                readOnly ||
                (isVirtualMatchId(activeMatch.id) && activeSlotPick
                  ? isBracketSlotPickLocked(activeSlotPick, matches)
                  : isPickLocked(activeMatch, matches))
              }
              onClose={closePickPanel}
              onSaved={handleSaved}
              onSlotSaved={handleSlotSaved}
              onAdvanceToNext={
                readOnly || !next ? undefined : () => openNextPick(from)
              }
              nextRoundLabel={nextRoundLabel}
            />
          );
        })()}
    </div>
  );
}
